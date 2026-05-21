import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
	PI_AGENT_CHANGE_CUSTOM_TYPE,
	buildPiAgentDiffForWindow,
	capturePiAgentChangeToolCall,
	createPiAgentDiffProviderFromEntries,
	extractApplyPatchPaths,
} from "./agent-changes";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempRepo(): string {
	const dir = mkdtempSync(join(tmpdir(), "plannotator-pi-agent-changes-"));
	tempDirs.push(dir);
	return dir;
}

function writeFile(root: string, path: string, content: string): string {
	const full = join(root, path);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, content, "utf-8");
	return full;
}

function userEntry(id: string) {
	return { type: "message", id, message: { role: "user" } };
}

function changeEntry(id: string, data: unknown) {
	return { type: "custom", id, customType: PI_AGENT_CHANGE_CUSTOM_TYPE, data };
}

describe("Pi agent changes provider", () => {
	test("builds a session diff from recorded pre-edit snapshots", async () => {
		const root = tempRepo();
		const file = writeFile(root, "src/app.ts", "after\n");
		const entries = [
			userEntry("u1"),
			changeEntry("c1", {
				version: 1,
				toolCallId: "tool-1",
				toolName: "edit",
				cwd: root,
				paths: [{ path: file, before: "before\n" }],
			}),
		];

		const provider = createPiAgentDiffProviderFromEntries(() => entries, root)!;
		expect(provider.listOptions()).toEqual([
			{ id: "agent-last-turn", label: "Last turn changes" },
			{ id: "agent-session", label: "Session changes" },
		]);

		const diff = await provider.buildDiff("agent-session");
		expect(diff.label).toBe("Session");
		expect(diff.fileBefores).toEqual({ "src/app.ts": "before\n" });
		expect(diff.patch).toContain("diff --git a/src/app.ts b/src/app.ts");
		expect(diff.patch).toContain("-before");
		expect(diff.patch).toContain("+after");
	});

	test("last-turn diff only includes edits after the latest user message", async () => {
		const root = tempRepo();
		const first = writeFile(root, "first.ts", "first after\n");
		const second = writeFile(root, "second.ts", "second after\n");
		const entries = [
			userEntry("u1"),
			changeEntry("c1", {
				version: 1,
				toolCallId: "tool-1",
				toolName: "write",
				cwd: root,
				paths: [{ path: first, before: "first before\n" }],
			}),
			userEntry("u2"),
			changeEntry("c2", {
				version: 1,
				toolCallId: "tool-2",
				toolName: "apply_patch",
				cwd: root,
				paths: [{ path: second, before: "second before\n" }],
			}),
		];

		const provider = createPiAgentDiffProviderFromEntries(() => entries, root)!;
		const diff = await provider.buildDiff("agent-last-turn");
		expect(diff.patch).not.toContain("first.ts");
		expect(diff.patch).toContain("second.ts");
		expect(diff.fileBefores).toEqual({ "second.ts": "second before\n" });
	});

	test("ignores agent-change records from a different Pi session", async () => {
		const root = tempRepo();
		const staleFile = writeFile(root, "stale.ts", "stale after\n");
		const currentFile = writeFile(root, "current.ts", "current after\n");
		const entries = [
			userEntry("u1"),
			changeEntry("old", {
				version: 1,
				sessionId: "old-session",
				sessionFile: "/tmp/old-session.jsonl",
				toolCallId: "tool-old",
				toolName: "edit",
				cwd: root,
				paths: [{ path: staleFile, before: "stale before\n" }],
			}),
			userEntry("u2"),
			changeEntry("new", {
				version: 1,
				sessionId: "current-session",
				sessionFile: "/tmp/current-session.jsonl",
				toolCallId: "tool-new",
				toolName: "edit",
				cwd: root,
				paths: [{ path: currentFile, before: "current before\n" }],
			}),
		];

		const provider = createPiAgentDiffProviderFromEntries(() => entries, root, {
			sessionId: "current-session",
			sessionFile: "/tmp/current-session.jsonl",
		})!;
		const sessionDiff = await provider.buildDiff("agent-session");
		expect(sessionDiff.patch).toContain("current.ts");
		expect(sessionDiff.patch).not.toContain("stale.ts");
		expect(sessionDiff.fileBefores).toEqual({ "current.ts": "current before\n" });

		const staleOnlyProvider = createPiAgentDiffProviderFromEntries(() => entries.slice(0, 2), root, {
			sessionId: "current-session",
			sessionFile: "/tmp/current-session.jsonl",
		})!;
		expect(staleOnlyProvider.listOptions()).toEqual([]);
	});


	test("ignores legacy untagged records inherited by a copied Pi session", async () => {
		const root = tempRepo();
		const file = writeFile(root, "stale.ts", "stale after\n");
		const entries = [
			userEntry("u1"),
			changeEntry("legacy", {
				version: 1,
				toolCallId: "tool-legacy",
				toolName: "edit",
				cwd: root,
				paths: [{ path: file, before: "stale before\n" }],
			}),
		];

		const originalProvider = createPiAgentDiffProviderFromEntries(() => entries, root, {
			sessionId: "original-session",
			sessionFile: "/tmp/original-session.jsonl",
		})!;
		expect(originalProvider.listOptions()).toContainEqual({ id: "agent-session", label: "Session changes" });

		const copiedProvider = createPiAgentDiffProviderFromEntries(() => entries, root, {
			sessionId: "copied-session",
			sessionFile: "/tmp/copied-session.jsonl",
			parentSession: "/tmp/original-session.jsonl",
		})!;
		expect(copiedProvider.listOptions()).toEqual([]);
	});

	test("captures apply_patch tool targets used by GPT models", () => {
		const root = tempRepo();
		const file = writeFile(root, "src/app.ts", "before\n");
		const patch = `*** Begin Patch
*** Update File: src/app.ts
@@
-before
+after
*** End Patch`;

		expect(extractApplyPatchPaths({ input: patch })).toEqual(["src/app.ts"]);
		expect(extractApplyPatchPaths(patch)).toEqual(["src/app.ts"]);
		const captured = capturePiAgentChangeToolCall({
			toolCallId: "tool-1",
			toolName: "apply_patch",
			input: { input: patch },
			cwd: root,
		});

		expect(captured).toMatchObject({
			version: 1,
			toolCallId: "tool-1",
			toolName: "apply_patch",
			cwd: root,
			paths: [{ path: file, before: "before\n" }],
		});
	});

	test("builds add-file diffs from null snapshots", () => {
		const root = tempRepo();
		const file = writeFile(root, "new.md", "created\n");
		const diff = buildPiAgentDiffForWindow(
			[
				changeEntry("c1", {
					version: 1,
					toolCallId: "tool-1",
					toolName: "apply_patch",
					cwd: root,
					paths: [{ path: file, before: null }],
				}),
			],
			0,
			root,
			"Session",
		);

		expect(diff.fileBefores).toEqual({ "new.md": null });
		expect(diff.patch).toContain("new file mode 100644");
		expect(diff.patch).toContain("+created");
	});
});
