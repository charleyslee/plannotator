import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

export interface LoadReviewSummaryOptions {
  cwd?: string;
  maxBytes?: number;
}

export function loadReviewSummaryFile(
  summaryFile: string | undefined,
  options: LoadReviewSummaryOptions = {},
): string | undefined {
  if (!summaryFile) return undefined;

  const path = resolve(options.cwd ?? process.cwd(), summaryFile);
  const maxBytes = options.maxBytes ?? 256 * 1024;
  const stat = statSync(path);

  if (!stat.isFile()) {
    throw new Error(`Review summary is not a file: ${path}`);
  }
  if (stat.size > maxBytes) {
    throw new Error(`Review summary is too large: ${path} (${stat.size} bytes, max ${maxBytes})`);
  }

  const summary = readFileSync(path, "utf8").trim();
  return summary || undefined;
}
