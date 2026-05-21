/**
 * Agent Changes Diff Provider (Claude Code)
 *
 * Builds review diffs from the Claude Code session transcript instead of the
 * VCS working tree, powering the "Last turn changes" and "Session changes"
 * review modes.
 *
 * Each file-editing tool result in the transcript records a `structuredPatch`
 * (git-style hunks) for that single edit. To get a coherent per-file diff for a
 * whole window (a turn or the entire session) we:
 *
 *   1. Read the file's CURRENT on-disk content ("after").
 *   2. Reverse-apply the window's structuredPatches, newest first, to recover
 *      the file's content before the agent's first edit in the window ("before").
 *   3. Diff before → after into one clean unified-diff section.
 *
 * Reverse reconstruction is used (rather than the unreliable `originalFile`
 * field, which Claude Code omits on most edits) because `structuredPatch` is
 * always present. If a patch fails to reverse-apply (the file drifted on disk
 * since the agent touched it), we fall back to the first edit's `originalFile`
 * when available, else treat the file as newly added.
 */

import { readFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { applyPatch, reversePatch, structuredPatch } from "diff";
import type {
  AgentDiffProvider,
  AgentDiffResult,
  AgentDiffType,
  DiffOption,
  GitDiffOptions,
} from "@plannotator/shared/review-core";
import {
  findSessionLogsForCwd,
  isHumanPrompt,
  parseSessionLog,
  resolveSessionLogByAncestorPids,
  resolveSessionLogByCwdScan,
  type SessionLogEntry,
} from "./session-log";

/** A single hunk as recorded in a transcript `structuredPatch`. */
interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

/** The file-edit signal extracted from one transcript entry. */
interface EditResult {
  filePath: string;
  hunks: PatchHunk[];
  /** "create" | "update" | null (Edit). */
  type: string | null;
  /** Full pre-edit content when Claude Code happened to record it (often absent). */
  originalFile?: string;
}

/** Per-file accumulation across a window, in chronological edit order. */
interface FileWindow {
  patches: PatchHunk[][];
  firstType: string | null;
  firstOriginal?: string;
}

/**
 * Resolve the current session's transcript path using the same tiered strategy
 * as annotate-last: ancestor-PID session metadata → cwd metadata scan → newest
 * jsonl for the cwd.
 */
export function resolveCurrentSessionLog(cwd: string): string | null {
  return (
    resolveSessionLogByAncestorPids({}) ??
    resolveSessionLogByCwdScan({ cwd }) ??
    findSessionLogsForCwd(cwd)[0] ??
    null
  );
}

/**
 * A transcript entry counts as a file edit when its tool result carries both a
 * `filePath` and a `structuredPatch`. Keying off the data shape (not the tool
 * name) covers Edit, Write, NotebookEdit and any future file-mutating tool.
 */
function getEditResult(entry: SessionLogEntry): EditResult | null {
  const result = (entry as { toolUseResult?: unknown }).toolUseResult;
  if (!result || typeof result !== "object") return null;
  const r = result as {
    filePath?: unknown;
    structuredPatch?: unknown;
    type?: unknown;
    originalFile?: unknown;
  };
  if (typeof r.filePath !== "string" || !Array.isArray(r.structuredPatch)) return null;
  return {
    filePath: r.filePath,
    hunks: r.structuredPatch as PatchHunk[],
    type: typeof r.type === "string" ? r.type : null,
    originalFile: typeof r.originalFile === "string" ? r.originalFile : undefined,
  };
}

/** Index of the last human-typed prompt — the start of the current turn. -1 if none. */
export function lastHumanPromptIndex(entries: SessionLogEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (isHumanPrompt(entries[i])) return i;
  }
  return -1;
}

/** Repo-relative path, or null when the file is outside the repo root. */
function toRepoRelative(absPath: string, repoRoot: string): string | null {
  if (!isAbsolute(absPath)) return absPath;
  const rel = relative(repoRoot, absPath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return rel.split("\\").join("/");
}

/** True if any in-window entry edits a file under `repoRoot`. */
function windowHasEdits(entries: SessionLogEntry[], windowStart: number, repoRoot: string): boolean {
  for (let i = Math.max(0, windowStart); i < entries.length; i++) {
    const edit = getEditResult(entries[i]);
    if (edit && toRepoRelative(edit.filePath, repoRoot) !== null) return true;
  }
  return false;
}

/** Collect every file edited in [windowStart, end], with patches in edit order. */
function collectWindow(
  entries: SessionLogEntry[],
  windowStart: number,
  repoRoot: string,
): Map<string, FileWindow> {
  const files = new Map<string, FileWindow>();
  for (let i = Math.max(0, windowStart); i < entries.length; i++) {
    const edit = getEditResult(entries[i]);
    if (!edit) continue;
    if (toRepoRelative(edit.filePath, repoRoot) === null) continue;
    let fw = files.get(edit.filePath);
    if (!fw) {
      fw = { patches: [], firstType: edit.type, firstOriginal: edit.originalFile };
      files.set(edit.filePath, fw);
    }
    fw.patches.push(edit.hunks);
  }
  return files;
}

function readDiskContent(absPath: string): string | null {
  try {
    return readFileSync(absPath, "utf-8");
  } catch {
    return null; // missing/deleted/binary
  }
}

/**
 * Recover the pre-window content by reverse-applying the window's patches to the
 * current content, newest first. Returns null if any patch fails to apply.
 */
function reconstructBefore(after: string, patches: PatchHunk[][], fileName: string): string | null {
  let content = after;
  for (let i = patches.length - 1; i >= 0; i--) {
    const reversed = reversePatch({
      oldFileName: fileName,
      newFileName: fileName,
      oldHeader: "",
      newHeader: "",
      hunks: patches[i],
    });
    const applied = applyPatch(content, reversed);
    if (applied === false) return null;
    content = applied;
  }
  return content;
}

/** Format a git-style `@@` hunk header (using `-0,0` for created/empty sides). */
function formatHunkHeader(h: { oldStart: number; oldLines: number; newStart: number; newLines: number }): string {
  const oldStart = h.oldLines === 0 ? 0 : h.oldStart;
  const newStart = h.newLines === 0 ? 0 : h.newStart;
  return `@@ -${oldStart},${h.oldLines} +${newStart},${h.newLines} @@`;
}

/** Build one `diff --git` section for a file from its before/after content. */
function formatFileSection(
  relPath: string,
  before: string,
  after: string,
  options?: GitDiffOptions,
): string {
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

/** Build the unified diff + file-before map for a window of transcript entries. */
export function buildDiffForWindow(
  entries: SessionLogEntry[],
  windowStart: number,
  repoRoot: string,
  label: string,
  options?: GitDiffOptions,
): AgentDiffResult {
  const files = collectWindow(entries, windowStart, repoRoot);
  const sections: string[] = [];
  const fileBefores: Record<string, string | null> = {};

  // Stable order: by repo-relative path for deterministic output.
  const sorted = [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [absPath, fw] of sorted) {
    const relPath = toRepoRelative(absPath, repoRoot);
    if (relPath === null) continue;

    const disk = readDiskContent(absPath);
    const after = disk ?? "";

    let before: string;
    if (fw.firstType === "create") {
      before = "";
    } else {
      before =
        reconstructBefore(after, fw.patches, relPath) ??
        fw.firstOriginal ??
        "";
    }

    if (before === after) continue; // net no-op (e.g. edited then reverted)

    const section = formatFileSection(relPath, before, after, options);
    if (!section) continue;
    sections.push(section);
    fileBefores[relPath] = before;
  }

  return { patch: sections.join(""), label, fileBefores };
}

/**
 * Create a Claude Code agent-diff provider for the given repo root, or null when
 * no session transcript can be resolved (e.g. running outside an interactive
 * session). Transcript entries are parsed once and cached for the provider's life.
 */
export function createClaudeAgentDiffProvider(repoRoot: string): AgentDiffProvider | null {
  const logPath = resolveCurrentSessionLog(repoRoot);
  if (!logPath) return null;

  let cached: SessionLogEntry[] | null = null;
  const getEntries = (): SessionLogEntry[] => {
    if (cached === null) {
      try {
        cached = parseSessionLog(readFileSync(logPath, "utf-8"));
      } catch {
        cached = [];
      }
    }
    return cached;
  };

  return {
    listOptions(): DiffOption[] {
      const entries = getEntries();
      if (!windowHasEdits(entries, 0, repoRoot)) return [];
      const options: DiffOption[] = [];
      const turnStart = lastHumanPromptIndex(entries);
      if (turnStart >= 0 && windowHasEdits(entries, turnStart, repoRoot)) {
        options.push({ id: "agent-last-turn", label: "Last turn changes" });
      }
      options.push({ id: "agent-session", label: "Session changes" });
      return options;
    },

    async buildDiff(diffType: AgentDiffType, options?: GitDiffOptions): Promise<AgentDiffResult> {
      const entries = getEntries();
      if (diffType === "agent-last-turn") {
        const turnStart = lastHumanPromptIndex(entries);
        return buildDiffForWindow(entries, Math.max(0, turnStart), repoRoot, "Last turn", options);
      }
      return buildDiffForWindow(entries, 0, repoRoot, "Session", options);
    },
  };
}
