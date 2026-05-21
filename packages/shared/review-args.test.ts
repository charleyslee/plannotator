import { describe, expect, test } from "bun:test";
import { parseReviewArgs } from "./review-args";

describe("parseReviewArgs", () => {
  test("defaults to auto VCS and local PR checkout", () => {
    expect(parseReviewArgs("")).toEqual({
      prUrl: undefined,
      vcsType: undefined,
      useLocal: true,
    });
  });

  test("parses --git without a PR URL", () => {
    expect(parseReviewArgs("--git")).toEqual({
      prUrl: undefined,
      vcsType: "git",
      useLocal: true,
    });
  });

  test("parses PR URLs before or after --git", () => {
    expect(parseReviewArgs("--git https://github.com/acme/repo/pull/12")).toEqual({
      prUrl: "https://github.com/acme/repo/pull/12",
      vcsType: "git",
      useLocal: true,
    });
    expect(parseReviewArgs("https://github.com/acme/repo/pull/12 --git")).toEqual({
      prUrl: "https://github.com/acme/repo/pull/12",
      vcsType: "git",
      useLocal: true,
    });
  });

  test("preserves --no-local for PR review mode", () => {
    expect(parseReviewArgs("--no-local https://github.com/acme/repo/pull/12")).toEqual({
      prUrl: "https://github.com/acme/repo/pull/12",
      vcsType: undefined,
      useLocal: false,
    });
  });

  test("accepts argv arrays from the compiled CLI", () => {
    expect(parseReviewArgs(["--git", "--no-local", "https://github.com/acme/repo/pull/12"])).toEqual({
      prUrl: "https://github.com/acme/repo/pull/12",
      vcsType: "git",
      useLocal: false,
    });
  });

  test("strips wrapping quotes from string and argv inputs", () => {
    expect(parseReviewArgs(`--git "https://github.com/acme/repo/pull/12"`).prUrl)
      .toBe("https://github.com/acme/repo/pull/12");
    expect(parseReviewArgs(["--git", "\"https://github.com/acme/repo/pull/12\""]).prUrl)
      .toBe("https://github.com/acme/repo/pull/12");
  });

  test("parses --summary-file separate value form", () => {
    expect(parseReviewArgs(["--summary-file", "/tmp/review-summary.md"])).toMatchObject({
      summaryFile: "/tmp/review-summary.md",
      prUrl: undefined,
    });
  });

  test("parses --summary-file equals form", () => {
    expect(parseReviewArgs("--summary-file=/tmp/review-summary.md")).toMatchObject({
      summaryFile: "/tmp/review-summary.md",
      prUrl: undefined,
    });
  });

  test("parses quoted summary paths from strings and argv arrays", () => {
    expect(parseReviewArgs(`--summary-file "/tmp/review summary.md"`).summaryFile)
      .toBe("/tmp/review summary.md");
    expect(parseReviewArgs(["--summary-file", "'/tmp/review summary.md'"]).summaryFile)
      .toBe("/tmp/review summary.md");
  });

  test("preserves PR URL parsing with summary file", () => {
    expect(parseReviewArgs("--summary-file /tmp/review-summary.md https://github.com/acme/repo/pull/12")).toMatchObject({
      prUrl: "https://github.com/acme/repo/pull/12",
      summaryFile: "/tmp/review-summary.md",
      useLocal: true,
    });
  });

  test("keeps non-url positional input as local review mode", () => {
    expect(parseReviewArgs("--git not-a-url")).toEqual({
      prUrl: undefined,
      vcsType: "git",
      useLocal: true,
    });
  });
});
