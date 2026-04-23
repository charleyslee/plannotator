/**
 * Parse CLI-style args arriving as a single whitespace-delimited string.
 *
 * Extracts the `--gate` and `--json` flags (issue #570) from the remainder,
 * which is treated as the target path. Leading `@` is stripped to match the
 * Claude Code path-arg convention used in apps/hook/server/index.ts.
 *
 * Used by the OpenCode plugin and Pi extension, where the whole args string
 * arrives pre-joined from the harness slash-command dispatcher. The Claude
 * Code binary parses argv directly with indexOf/splice and does not use
 * this helper.
 */

export interface ParsedAnnotateArgs {
  filePath: string;
  gate: boolean;
  json: boolean;
}

export function parseAnnotateArgs(raw: string): ParsedAnnotateArgs {
  const tokens = (raw ?? "").trim().split(/\s+/).filter(Boolean);
  const gate = tokens.includes("--gate");
  const json = tokens.includes("--json");
  const filePath = tokens
    .filter((t) => t !== "--gate" && t !== "--json")
    .join(" ")
    .replace(/^@/, "");
  return { filePath, gate, json };
}
