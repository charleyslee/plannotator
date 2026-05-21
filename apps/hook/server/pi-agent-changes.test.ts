import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { createPiAgentDiffProviderFromSessionFile } from "./pi-agent-changes";

function tempDir(): string {
	return mkdtempSync(join(tmpdir(), "plannotator-pi-cli-"));
}

function writeJsonl(path: string, entries: unknown[]): void {
	writeFileSync(path, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
}

describe("Pi CLI session bridge", () => {
	test("builds a session diff from one Pi session-file env var", async () => {
		const root = tempDir();
		const file = join(root, "changed.ts");
		writeFileSync(file, "after\n");
		const sessionFile = join(root, "session.jsonl");
		writeJsonl(sessionFile, [
			{ id: "session-1", timestamp: "2026-05-21T00:00:00.000Z" },
			{ type: "message", message: { role: "user", content: "change it" } },
			{
				type: "custom",
				customType: "plannotator-agent-change",
				data: {
					version: 1,
					sessionId: "session-1",
					sessionFile,
					toolCallId: "tool-1",
					toolName: "edit",
					cwd: root,
					paths: [{ path: file, before: "before\n" }],
				},
			},
		]);

		const provider = createPiAgentDiffProviderFromSessionFile(sessionFile, root)!;
		expect(provider.listOptions()).toEqual([
			{ id: "agent-last-turn", label: "Last turn changes" },
			{ id: "agent-session", label: "Session changes" },
		]);
		const diff = await provider.buildDiff("agent-session");
		expect(diff.patch).toContain("changed.ts");
		expect(diff.patch).toContain("-before");
		expect(diff.patch).toContain("+after");
	});

	test("ignores legacy untagged records in copied Pi sessions", () => {
		const root = tempDir();
		const file = join(root, "stale.ts");
		writeFileSync(file, "after\n");
		const sessionFile = join(root, "copied.jsonl");
		writeJsonl(sessionFile, [
			{ id: "copied-session", parentSession: "/tmp/original.jsonl" },
			{
				type: "custom",
				customType: "plannotator-agent-change",
				data: {
					version: 1,
					toolCallId: "legacy-tool",
					toolName: "edit",
					cwd: root,
					paths: [{ path: file, before: "stale before\n" }],
				},
			},
		]);

		const provider = createPiAgentDiffProviderFromSessionFile(sessionFile, root)!;
		expect(provider.listOptions()).toEqual([]);
	});
});
