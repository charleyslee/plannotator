---
name: plannotator-review
description: Open Plannotator's browser-based code review UI for the current worktree or a pull request URL, then act on the feedback that comes back.
---

# Plannotator Review

Use this skill when the user wants to review current code changes in Plannotator instead of reading a diff inline.

Before launching, write a concise markdown summary of your changes to a temp file, then pass it with `--summary-file`:

```bash
summary_file="$(mktemp -t plannotator-review-summary.XXXXXX.md)"
cat > "$summary_file" <<'EOF'
## What changed
- ...

## Notes for reviewer
- ...
EOF
plannotator review --summary-file "$summary_file" [optional-pr-url]
```

For session-scoped reviews, combine with `--session` or `--last-turn`.

In Pi, if the shell tool injects `PLANNOTATOR_PI_SESSION_FILE`, the same CLI command
uses Pi's active session records for `--session` / `--last-turn` diffs. If that env
var is absent and the user specifically wants Pi session-scoped changes, ask the user
to run `/plannotator-review` instead of falling back silently.

Review modes (Claude Code, local reviews):

- Default — reviews the changes **you made this session**, reconstructed from the
  session transcript. Falls back to the VCS working-tree diff when there's no
  agent session.
- `plannotator review --last-turn` — only the files you edited since the user's
  last message.
- `plannotator review --session` — everything you've edited this session.
- `plannotator review --git` — force the VCS working-tree diff (uncommitted
  changes) instead of the transcript-derived view.

These same options are also switchable in the review UI's diff-type picker, so the
user can move between "Last turn changes", "Session changes", and the Git views
without relaunching. Pass a PR URL to review a pull request instead.

Behavior:

1. Launch the command with Bash.
2. Wait for it to finish.
3. If it returns feedback or annotations, address them in the same conversation.
4. If it returns an approval/LGTM-style message, acknowledge that review passed and continue.

Do not ask the user to copy shell commands into chat. Run the command yourself.
