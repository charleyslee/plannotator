import { describe, test, expect } from "bun:test";
import { parseAnnotateArgs } from "./annotate-args";

describe("parseAnnotateArgs", () => {
  test("path only", () => {
    expect(parseAnnotateArgs("spec.md")).toEqual({
      filePath: "spec.md",
      gate: false,
      json: false,
    });
  });

  test("path with --gate at end", () => {
    expect(parseAnnotateArgs("spec.md --gate")).toEqual({
      filePath: "spec.md",
      gate: true,
      json: false,
    });
  });

  test("--gate before path", () => {
    expect(parseAnnotateArgs("--gate spec.md")).toEqual({
      filePath: "spec.md",
      gate: true,
      json: false,
    });
  });

  test("path with both flags", () => {
    expect(parseAnnotateArgs("spec.md --gate --json")).toEqual({
      filePath: "spec.md",
      gate: true,
      json: true,
    });
  });

  test("flags only, no path", () => {
    expect(parseAnnotateArgs("--gate --json")).toEqual({
      filePath: "",
      gate: true,
      json: true,
    });
  });

  test("path with spaces rejoins with single space", () => {
    expect(parseAnnotateArgs("my file.md --gate")).toEqual({
      filePath: "my file.md",
      gate: true,
      json: false,
    });
  });

  test("leading @ is stripped", () => {
    expect(parseAnnotateArgs("@spec.md --gate")).toEqual({
      filePath: "spec.md",
      gate: true,
      json: false,
    });
  });

  test("URL passes through", () => {
    expect(parseAnnotateArgs("https://example.com/docs --gate")).toEqual({
      filePath: "https://example.com/docs",
      gate: true,
      json: false,
    });
  });

  test("extra whitespace is collapsed", () => {
    expect(parseAnnotateArgs("  spec.md   --gate  ")).toEqual({
      filePath: "spec.md",
      gate: true,
      json: false,
    });
  });

  test("empty string produces empty result", () => {
    expect(parseAnnotateArgs("")).toEqual({
      filePath: "",
      gate: false,
      json: false,
    });
  });

  test("nullish input is tolerated", () => {
    expect(parseAnnotateArgs(undefined as unknown as string)).toEqual({
      filePath: "",
      gate: false,
      json: false,
    });
  });

  test("folder path with trailing slash", () => {
    expect(parseAnnotateArgs("./specs/ --gate --json")).toEqual({
      filePath: "./specs/",
      gate: true,
      json: true,
    });
  });
});
