import { describe, expect, test } from 'bun:test';
import { parseCommonArgs, UsageError } from './_lib';

describe('parseCommonArgs', () => {
  // Regression: earlier the parser used the literal string 'true' as its
  // boolean-flag sentinel, so a user flag value that happened to be the
  // 4-character string 'true' (e.g. `--text true` as a comment body) got
  // silently dropped during re-emit. Downstream `readStringFlag` then
  // threw "--text requires a value" even though one was supplied. Pinning
  // this so a future refactor can't quietly bring the collision back.
  test('preserves the literal string "true" as a flag value', () => {
    const result = parseCommonArgs([
      '--url', 'https://example.com#key=abc',
      '--user', 'alice',
      '--type', 'claude',
      '--text', 'true',
    ]);
    expect(result.rest).toEqual(['--text', 'true']);
  });

  test('treats --flag with no following value as a boolean (no re-emit value)', () => {
    const result = parseCommonArgs([
      '--url', 'https://example.com#key=abc',
      '--user', 'alice',
      '--type', 'claude',
      '--dry-run',
    ]);
    expect(result.rest).toEqual(['--dry-run']);
  });

  test('rejects missing required --url', () => {
    expect(() => parseCommonArgs(['--user', 'alice', '--type', 'claude']))
      .toThrow(UsageError);
  });
});
