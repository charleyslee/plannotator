/**
 * Pi agent-change diff provider.
 *
 * Pi does not write a Claude-style transcript with structured patches. Instead,
 * the extension observes file-mutating tool calls while they run, records the
 * pre-edit contents as session custom entries, and later builds review diffs
 * from those snapshots for "Last turn changes" and "Session changes".
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { structuredPatch } from "diff";
import type {
	AgentDiffProvider,
	AgentDiffResult,
	AgentDiffType,
	DiffOption,
	GitDiffOptions,
} from "@plannotator/shared/review-core";

export const PI_AGENT_CHANGE_CUSTOM_TYPE = "plannotator-agent-change";

export interface PiAgentChangedPath {
	/** Absolute path when recorded by the live extension. */
	path: string;
	/** File contents before this tool call, or null when the file did not exist. */
	before: string | null;
}

export interface PiAgentChangeRecord {
	version: 1;
	/** Pi session id that produced this record. Added to prevent stale records from other sessions. */
	sessionId?: string;
	/** Pi session file that produced this record. Added as a fallback when ids are unavailable. */
	sessionFile?: string;
	toolCallId: string;
	toolName: string;
	cwd: string;
	paths: PiAgentChangedPath[];
}

export interface PiAgentSessionRef {
	sessionId?: string;
	sessionFile?: string;
	/** Present when Pi created this session from another session (fork/clone/copy). */
	parentSession?: string;
}

interface SessionMessageLike {
	role?: unknown;
}

interface SessionEntryLike {
	type?: unknown;
	message?: SessionMessageLike;
	customType?: unknown;
	data?: unknown;
}

export interface PendingPiAgentChange extends PiAgentChangeRecord {
	succeeded?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readTextOrNull(path: string): string | null {
	try {
		return readFileSync(path, "utf-8");
	} catch {
		return null;
	}
}

function normalizeToolPath(path: string): string {
	// Built-in Pi path tools strip a leading @ to accommodate @file references.
	return path.startsWith("@") ? path.slice(1) : path;
}

function resolveToolPath(path: string, cwd: string): string {
	const normalized = normalizeToolPath(path);
	return isAbsolute(normalized) ? normalized : resolve(cwd, normalized);
}

function toRepoRelative(absPath: string, repoRoot: string): string | null {
	const rel = relative(resolve(repoRoot), resolve(absPath));
	if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
	return rel.split("\\").join("/");
}

function uniqueStrings(values: Iterable<string>): string[] {
	return [...new Set([...values].filter(Boolean))];
}

function patchTextFromInput(input: unknown): string | null {
	if (typeof input === "string") return input;
	if (!isRecord(input)) return null;
	for (const key of ["input", "patch", "content", "text"]) {
		const value = input[key];
		if (typeof value === "string") return value;
	}
	return null;
}

function stripGitDiffPrefix(path: string): string {
	if (path === "/dev/null") return path;
	return path.replace(/^[ab]\//, "");
}

/** Extract target file paths from OpenAI/Codex-style apply_patch input. */
export function extractApplyPatchPaths(input: unknown): string[] {
	const patch = patchTextFromInput(input);
	if (!patch) return [];

	const paths: string[] = [];
	for (const rawLine of patch.split(/\r?\n/)) {
		const line = rawLine.trimEnd();
		const fileHeader = line.match(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/);
		if (fileHeader) {
			paths.push(fileHeader[1].trim());
			continue;
		}

		const moveHeader = line.match(/^\*\*\* Move to: (.+)$/);
		if (moveHeader) {
			paths.push(moveHeader[1].trim());
			continue;
		}

		const oldFile = line.match(/^---\s+(\S.*)$/);
		if (oldFile) {
			const path = stripGitDiffPrefix(oldFile[1].trim());
			if (path !== "/dev/null") paths.push(path);
			continue;
		}

		const newFile = line.match(/^\+\+\+\s+(\S.*)$/);
		if (newFile) {
			const path = stripGitDiffPrefix(newFile[1].trim());
			if (path !== "/dev/null") paths.push(path);
		}
	}

	return uniqueStrings(paths);
}

export function getPiAgentMutationPaths(toolName: string, input: unknown): string[] {
	if (toolName === "apply_patch") {
		return extractApplyPatchPaths(input);
	}

	if (!isRecord(input)) return [];

	if (toolName === "write" || toolName === "edit") {
		return typeof input.path === "string" ? [input.path] : [];
	}

	return [];
}

export function capturePiAgentChangeToolCall(options: {
	toolCallId: string;
	toolName: string;
	input: unknown;
	cwd: string;
	session?: PiAgentSessionRef;
}): PendingPiAgentChange | null {
	const paths = getPiAgentMutationPaths(options.toolName, options.input);
	if (paths.length === 0) return null;

	const snapshots: PiAgentChangedPath[] = [];
	for (const path of paths) {
		const absPath = resolveToolPath(path, options.cwd);
		// Keep only files inside the active Pi working directory. This mirrors the
		// review server's local-file access boundary and avoids leaking arbitrary
		// absolute paths into the session file.
		if (toRepoRelative(absPath, options.cwd) === null) continue;
		snapshots.push({ path: absPath, before: existsSync(absPath) ? readTextOrNull(absPath) : null });
	}

	if (snapshots.length === 0) return null;
	return {
		version: 1,
		...(options.session?.sessionId ? { sessionId: options.session.sessionId } : {}),
		...(options.session?.sessionFile ? { sessionFile: options.session.sessionFile } : {}),
		toolCallId: options.toolCallId,
		toolName: options.toolName,
		cwd: options.cwd,
		paths: snapshots,
	};
}

export function isPiAgentChangeRecord(value: unknown): value is PiAgentChangeRecord {
	if (!isRecord(value)) return false;
	if (value.version !== 1) return false;
	if ("sessionId" in value && typeof value.sessionId !== "string") return false;
	if ("sessionFile" in value && typeof value.sessionFile !== "string") return false;
	if (typeof value.toolCallId !== "string") return false;
	if (typeof value.toolName !== "string") return false;
	if (typeof value.cwd !== "string") return false;
	if (!Array.isArray(value.paths)) return false;
	return value.paths.every((path) => {
		if (!isRecord(path)) return false;
		return typeof path.path === "string" && (typeof path.before === "string" || path.before === null);
	});
}

function matchesPiAgentSession(record: PiAgentChangeRecord, session?: PiAgentSessionRef): boolean {
	if (!session) return true;
	// Legacy records written before session tagging are valid only in original
	// sessions. Forked/cloned sessions can inherit those untagged entries from a
	// parent, where they would make a fresh session look stuck on old diff data.
	if (!record.sessionId && !record.sessionFile) return !session.parentSession;
	if (record.sessionId && session.sessionId) return record.sessionId === session.sessionId;
	if (record.sessionFile && session.sessionFile) return record.sessionFile === session.sessionFile;
	return false;
}

function getPiAgentChangeRecord(entry: SessionEntryLike, session?: PiAgentSessionRef): PiAgentChangeRecord | null {
	if (entry.type !== "custom" || entry.customType !== PI_AGENT_CHANGE_CUSTOM_TYPE) return null;
	if (!isPiAgentChangeRecord(entry.data)) return null;
	return matchesPiAgentSession(entry.data, session) ? entry.data : null;
}

function lastUserMessageIndex(entries: SessionEntryLike[]): number {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type === "message" && entry.message?.role === "user") return i;
	}
	return -1;
}

function windowHasChanges(
	entries: SessionEntryLike[],
	windowStart: number,
	repoRoot: string,
	session?: PiAgentSessionRef,
): boolean {
	for (let i = Math.max(0, windowStart); i < entries.length; i++) {
		const record = getPiAgentChangeRecord(entries[i], session);
		if (!record) continue;
		if (record.paths.some((path) => toRepoRelative(path.path, repoRoot) !== null)) return true;
	}
	return false;
}

function formatHunkHeader(h: { oldStart: number; oldLines: number; newStart: number; newLines: number }): string {
	const oldStart = h.oldLines === 0 ? 0 : h.oldStart;
	const newStart = h.newLines === 0 ? 0 : h.newStart;
	return `@@ -${oldStart},${h.oldLines} +${newStart},${h.newLines} @@`;
}

function formatFileSection(relPath: string, before: string, after: string, options?: GitDiffOptions): string {
	const sp = structuredPatch(relPath, relPath, before, after, "", "", {
		context: 3,
		ignoreWhitespace: options?.hideWhitespace ?? false,
	});
	if (sp.hunks.length === 0) return "";

	const isNew = before === "";
	const isDelete = after === "";
	let header = `diff --git a/${relPath} b/${relPath}\n`;
	if (isNew) header += `new file mode 100644\n--- /dev/null\n+++ b/${relPath}\n`;
	else if (isDelete) header += `deleted file mode 100644\n--- a/${relPath}\n+++ /dev/null\n`;
	else header += `--- a/${relPath}\n+++ b/${relPath}\n`;

	const body = sp.hunks
		.map((h) => `${formatHunkHeader(h)}\n${h.lines.join("\n")}`)
		.join("\n");
	return `${header}${body}\n`;
}

export function buildPiAgentDiffForWindow(
	entries: SessionEntryLike[],
	windowStart: number,
	repoRoot: string,
	label: string,
	options?: GitDiffOptions,
	session?: PiAgentSessionRef,
): AgentDiffResult {
	const firstBeforeByPath = new Map<string, { absPath: string; before: string | null }>();

	for (let i = Math.max(0, windowStart); i < entries.length; i++) {
		const record = getPiAgentChangeRecord(entries[i], session);
		if (!record) continue;

		for (const changedPath of record.paths) {
			const relPath = toRepoRelative(changedPath.path, repoRoot);
			if (relPath === null || firstBeforeByPath.has(relPath)) continue;
			firstBeforeByPath.set(relPath, { absPath: changedPath.path, before: changedPath.before });
		}
	}

	const sections: string[] = [];
	const fileBefores: Record<string, string | null> = {};
	const sorted = [...firstBeforeByPath.entries()].sort((a, b) => a[0].localeCompare(b[0]));

	for (const [relPath, snapshot] of sorted) {
		const before = snapshot.before ?? "";
		const after = readTextOrNull(snapshot.absPath) ?? "";
		if (before === after) continue;

		const section = formatFileSection(relPath, before, after, options);
		if (!section) continue;
		sections.push(section);
		fileBefores[relPath] = snapshot.before;
	}

	return { patch: sections.join(""), label, fileBefores };
}

export function createPiAgentDiffProviderFromEntries(
	getEntries: () => SessionEntryLike[],
	repoRoot: string,
	session?: PiAgentSessionRef,
): AgentDiffProvider | null {
	return {
		listOptions(): DiffOption[] {
			const entries = getEntries();
			if (!windowHasChanges(entries, 0, repoRoot, session)) return [];

			const options: DiffOption[] = [];
			const turnStart = lastUserMessageIndex(entries);
			if (turnStart >= 0 && windowHasChanges(entries, turnStart, repoRoot, session)) {
				options.push({ id: "agent-last-turn", label: "Last turn changes" });
			}
			options.push({ id: "agent-session", label: "Session changes" });
			return options;
		},

		async buildDiff(diffType: AgentDiffType, options?: GitDiffOptions): Promise<AgentDiffResult> {
			const entries = getEntries();
			if (diffType === "agent-last-turn") {
				const turnStart = lastUserMessageIndex(entries);
				return buildPiAgentDiffForWindow(entries, Math.max(0, turnStart), repoRoot, "Last turn", options, session);
			}
			return buildPiAgentDiffForWindow(entries, 0, repoRoot, "Session", options, session);
		},
	};
}

function parsePiSessionJsonl(sessionFile: string): { header: PiAgentSessionRef; entries: SessionEntryLike[] } | null {
	let text: string;
	try {
		text = readFileSync(sessionFile, "utf-8");
	} catch {
		return null;
	}

	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	if (lines.length === 0) return null;

	let header: Record<string, unknown> = {};
	try {
		const parsed = JSON.parse(lines[0]);
		if (isRecord(parsed)) header = parsed;
	} catch {
		return null;
	}

	const entries: SessionEntryLike[] = [];
	for (const line of lines.slice(1)) {
		try {
			const parsed = JSON.parse(line);
			if (isRecord(parsed)) entries.push(parsed as SessionEntryLike);
		} catch {
			// Ignore malformed trailing/partial lines. Pi may be writing the session
			// concurrently while a shell-launched Plannotator review starts.
		}
	}

	return {
		header: {
			sessionId: typeof header.id === "string" ? header.id : undefined,
			sessionFile,
			parentSession: typeof header.parentSession === "string" ? header.parentSession : undefined,
		},
		entries,
	};
}

/**
 * Build a Pi transcript-diff provider for the standalone CLI.
 *
 * The Pi extension injects a single env var, PLANNOTATOR_PI_SESSION_FILE, into
 * agent shell commands. From that one file the CLI can recover the session id,
 * parent-session marker, and recorded plannotator-agent-change entries.
 */
export function createPiAgentDiffProviderFromSessionFile(sessionFile: string | undefined, repoRoot: string): AgentDiffProvider | null {
	if (!sessionFile) return null;
	const parsed = parsePiSessionJsonl(sessionFile);
	if (!parsed) return null;
	return createPiAgentDiffProviderFromEntries(() => parsed.entries, repoRoot, parsed.header);
}
