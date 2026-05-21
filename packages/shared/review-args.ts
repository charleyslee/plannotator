import type { VcsSelection } from "./vcs-core";
import type { AgentDiffType } from "./review-core";
import { stripWrappingQuotes } from "./resolve-file";

export interface ParsedReviewArgs {
  prUrl?: string;
  vcsType?: VcsSelection;
  useLocal: boolean;
  /**
   * Launch directly into a transcript-derived diff: `--last-turn` reviews the
   * files the agent edited since the last user message, `--session` the whole
   * session. Local mode only (ignored with a PR URL).
   */
  agentDiffType?: AgentDiffType;
  summaryFile?: string;
}

export function parseReviewArgs(input: string | string[]): ParsedReviewArgs {
  const tokens = Array.isArray(input)
    ? input.map((token) => stripWrappingQuotes(token.trim())).filter(Boolean)
    : tokenizeReviewArgs(input ?? "");

  let vcsType: VcsSelection | undefined;
  let useLocal = true;
  let agentDiffType: AgentDiffType | undefined;
  let summaryFile: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token) {
      case "--git":
        vcsType = "git";
        break;
      case "--local":
        useLocal = true;
        break;
      case "--no-local":
        useLocal = false;
        break;
      case "--last-turn":
        agentDiffType = "agent-last-turn";
        break;
      case "--session":
        agentDiffType = "agent-session";
        break;
      case "--summary-file":
        summaryFile = tokens[++i];
        break;
      default:
        if (token.startsWith("--summary-file=")) {
          summaryFile = token.slice("--summary-file=".length);
          break;
        }
        positional.push(token);
        break;
    }
  }

  const target = positional[0];
  return {
    prUrl: target && isReviewUrl(target) ? target : undefined,
    vcsType,
    useLocal,
    agentDiffType,
    summaryFile,
  };
}

function isReviewUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function tokenizeReviewArgs(input: string): string[] {
  const raw = input.trim();
  if (!raw) return [];

  const tokens: string[] = [];
  let current = "";
  let quote: "'" | "\"" | undefined;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) tokens.push(current);
  return tokens.map((token) => stripWrappingQuotes(token.trim())).filter(Boolean);
}
