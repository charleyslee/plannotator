import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { structuredPatch } from "diff";
import { buildDiffForWindow, lastHumanPromptIndex } from "./agent-changes";
import type { SessionLogEntry } from "./session-log";

/** Synthetic transcript helpers mirroring real Claude Code entries. */
function humanPrompt(text: string): SessionLogEntry {
  return { type: "user", message: { content: text } };
}

/**
 * A file-edit entry. `structuredPatch` is computed from before→after exactly as
 * Claude Code records it. `originalFile` is intentionally omitted by default —
 * the common case the reverse-apply reconstruction must handle.
 */
function editEntry(
  filePath: string,
  before: string,
  after: string,
  opts: { type?: string | null; originalFile?: string } = {},
): SessionLogEntry {
  const sp = structuredPatch(filePath, filePath, before, after, "", "", { context: 3 });
  return {
    type: "user",
    toolUseResult: {
      filePath,
      structuredPatch: sp.hunks,
      type: opts.type ?? null,
      ...(opts.originalFile !== undefined ? { originalFile: opts.originalFile } : {}),
    },
  } as SessionLogEntry;
}

function withRepo(fn: (repoRoot: string) => void): void {
  const repoRoot = mkdtempSync(join(tmpdir(), "agent-changes-"));
  try {
    fn(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

test("reconstructs 'before' by reverse-applying the patch when originalFile is absent", () => {
  withRepo((repoRoot) => {
    const abs = join(repoRoot, "f.txt");
    const before = "alpha\nbeta\ngamma\n";
    const after = "alpha\nBETA\ngamma\n";
    writeFileSync(abs, after); // disk holds the "after" state

    const entries = [humanPrompt("tweak beta"), editEntry(abs, before, after)];
    const result = buildDiffForWindow(entries, 0, repoRoot, "Session");

    expect(result.patch).toContain("diff --git a/f.txt b/f.txt");
    expect(result.patch).toContain("-beta");
    expect(result.patch).toContain("+BETA");
    expect(result.fileBefores["f.txt"]).toBe(before);
  });
});

test("composes multiple edits to one file into a single before→after diff", () => {
  withRepo((repoRoot) => {
    const abs = join(repoRoot, "f.txt");
    const before0 = "x\ny\n";
    const mid = "x\nY\n";
    const after = "x\nY\nz\n";
    writeFileSync(abs, after);

    const entries = [editEntry(abs, before0, mid), editEntry(abs, mid, after)];
    const result = buildDiffForWindow(entries, 0, repoRoot, "Session");

    // Reconstructed baseline is the state before the *first* edit in the window.
    expect(result.fileBefores["f.txt"]).toBe(before0);
    expect(result.patch).toContain("+z");
  });
});

test("last-turn window excludes edits made before the last human prompt", () => {
  withRepo((repoRoot) => {
    const absA = join(repoRoot, "a.txt");
    const absB = join(repoRoot, "b.txt");
    writeFileSync(absA, "1\n2\n");
    writeFileSync(absB, "P\n");

    const entries = [
      editEntry(absA, "1\n", "1\n2\n"), // turn 0
      humanPrompt("now do B"),
      editEntry(absB, "p\n", "P\n"), // turn 1 (current)
    ];

    const turnStart = lastHumanPromptIndex(entries);
    const lastTurn = buildDiffForWindow(entries, turnStart, repoRoot, "Last turn");
    expect(Object.keys(lastTurn.fileBefores)).toEqual(["b.txt"]);
    expect(lastTurn.patch).toContain("b/b.txt");
    expect(lastTurn.patch).not.toContain("a.txt");

    const session = buildDiffForWindow(entries, 0, repoRoot, "Session");
    expect(Object.keys(session.fileBefores).sort()).toEqual(["a.txt", "b.txt"]);
  });
});

test("created files render as new-file sections with an empty before", () => {
  withRepo((repoRoot) => {
    const abs = join(repoRoot, "new.txt");
    const after = "hello\nworld\n";
    writeFileSync(abs, after);

    const entries = [editEntry(abs, "", after, { type: "create" })];
    const result = buildDiffForWindow(entries, 0, repoRoot, "Session");

    expect(result.patch).toContain("new file mode 100644");
    expect(result.patch).toContain("--- /dev/null");
    expect(result.fileBefores["new.txt"]).toBe("");
  });
});

test("files in nested dirs use forward-slashed repo-relative paths", () => {
  withRepo((repoRoot) => {
    mkdirSync(join(repoRoot, "src", "lib"), { recursive: true });
    const abs = join(repoRoot, "src", "lib", "util.ts");
    const before = "export const a = 1;\n";
    const after = "export const a = 2;\n";
    writeFileSync(abs, after);

    const entries = [editEntry(abs, before, after)];
    const result = buildDiffForWindow(entries, 0, repoRoot, "Session");

    expect(result.patch).toContain("diff --git a/src/lib/util.ts b/src/lib/util.ts");
    expect(result.fileBefores["src/lib/util.ts"]).toBe(before);
  });
});

test("edits to files outside the repo root are ignored", () => {
  withRepo((repoRoot) => {
    const outside = join(tmpdir(), "outside-repo-file.txt");
    writeFileSync(outside, "changed\n");
    try {
      const entries = [editEntry(outside, "orig\n", "changed\n")];
      const result = buildDiffForWindow(entries, 0, repoRoot, "Session");
      expect(result.patch).toBe("");
      expect(Object.keys(result.fileBefores)).toEqual([]);
    } finally {
      rmSync(outside, { force: true });
    }
  });
});
