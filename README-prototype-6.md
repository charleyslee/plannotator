<p align="center">
  <img src="apps/marketing/public/plannotator.webp" alt="Plannotator" width="180" />
</p>

<h1 align="center">Plannotator</h1>

<p align="center">
  <strong>Plan and code review for AI coding agents</strong><br/>
  <sub>Annotate plans before execution. Review diffs before commit. Send structured feedback back to the agent.</sub>
</p>

<p align="center">
  <a href="https://github.com/backnotprop/plannotator/releases"><img src="https://img.shields.io/github/v/release/backnotprop/plannotator?style=flat-square&color=blue" alt="Release" /></a>&nbsp;
  <a href="https://github.com/backnotprop/plannotator/stargazers"><img src="https://img.shields.io/github/stars/backnotprop/plannotator?style=flat-square&color=yellow" alt="Stars" /></a>&nbsp;
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT%20%2F%20Apache--2.0-green?style=flat-square" alt="License" /></a>&nbsp;
  <a href="https://plannotator.ai/docs"><img src="https://img.shields.io/badge/docs-plannotator.ai-purple?style=flat-square" alt="Docs" /></a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">Watch demo</a> &middot; <a href="https://plannotator.ai/docs/getting-started/installation/">Install</a> &middot; <a href="https://plannotator.ai/docs/">Docs</a> &middot; <a href="https://share.plannotator.ai">Try it live</a>
</p>

---

Your agent writes a plan. You get a `y/n` prompt in the terminal. You skim it, press `y`, and three minutes later you're undoing damage.

Plannotator replaces that moment with a real review workspace. Your agent's plan opens in the browser — select text, comment on it, mark things for deletion, write replacements. When you deny, your annotations go back as structured feedback the agent can act on. When you approve, you know what you approved.

Same workflow for code: `/plannotator-review` gives you a PR-style diff viewer over your agent's uncommitted changes — or any GitHub/GitLab PR URL.

Runs entirely on your machine. Plans never leave your browser. Free and open source.

<p align="center">
  <a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">
    <img src="apps/marketing/public/youtube.png" alt="Watch the Plannotator demo" width="640" />
  </a>
  <br/>
  <sub>2-minute demo — Claude Code plan review</sub>
</p>

---

## Features

### Plan Review

<table>
<tr>
<td width="50%">

When your agent proposes a plan, Plannotator intercepts the approval step and opens a review workspace. Annotate inline, mark deletions, write replacements, attach screenshots. Approve or deny with structured feedback.

**Happens automatically** — hooks into your agent's plan mode. No command to run.

</td>
<td width="50%">

<img src="apps/marketing/public/assets/plan-review.webp" alt="Plan review UI with inline annotations" width="100%" />

</td>
</tr>
</table>

### Code Review

<table>
<tr>
<td width="50%">

<img src="readme-assets/code-review-thumbnail.png" alt="Code review with file tree and side-by-side diff" width="100%" />

</td>
<td width="50%">

Run `/plannotator-review` for a PR-style diff viewer. Side-by-side or unified diffs, file tree navigation, line-level annotations. Stage or unstage files before committing. Pass a GitHub or GitLab PR URL to review remote pull requests.

Built-in AI assistant to ask questions about the diff as you review.

</td>
</tr>
</table>

### Annotate Anything

<table>
<tr>
<td width="50%">

Run `/plannotator-annotate` on any markdown file, HTML page, URL, or folder. Annotate the agent's last message with `/plannotator-last`. Your annotations become structured feedback the agent can use.

Supports `.md`, `.mdx`, `.html`, URLs (fetched via [Jina Reader](https://jina.ai/reader/)), and folder browsing.

</td>
<td width="50%">

<img src="readme-assets/annotate.png" alt="Annotate mode with TOC sidebar and inline annotations" width="100%" />

</td>
</tr>
</table>

### Plan Diff

<table>
<tr>
<td width="50%">

<img src="readme-assets/plan-diff.png" alt="Plan diff showing changes between revisions" width="100%" />

</td>
<td width="50%">

When you deny a plan and the agent resubmits, the UI shows exactly what changed. Color-coded rendered diff or raw git-style `+/-` view. Browse and compare any version from the sidebar.

Every revision is saved automatically to version history.

</td>
</tr>
</table>

### Sharing & Collaboration

<table>
<tr>
<td width="50%">

Share annotated plans with teammates via URL. A colleague can annotate a shared plan — import their feedback and send it straight to your agent.

**Small plans** encode entirely in the URL hash — no server involved. **Large plans** use E2E encrypted paste (AES-256-GCM, zero-knowledge, [self-hostable](https://plannotator.ai/docs/guides/sharing-and-collaboration/)). Pastes auto-delete after 7 days.

</td>
<td width="50%">

<img src="readme-assets/sharing.png" alt="Sharing portal for live review rooms" width="100%" />

</td>
</tr>
</table>

---

## Get Started

Plannotator works with **Claude Code**, **Copilot CLI**, **Gemini CLI**, **OpenCode**, **Pi**, and **Codex**.

**[Installation Guide](https://plannotator.ai/docs/getting-started/installation/)** — setup instructions for every supported agent.

| Agent | Quick reference |
|---|---|
| Claude Code | [apps/hook/README.md](apps/hook/README.md) |
| Copilot CLI | [apps/copilot/README.md](apps/copilot/README.md) |
| Gemini CLI | [apps/gemini/README.md](apps/gemini/README.md) |
| OpenCode | [apps/opencode-plugin/README.md](apps/opencode-plugin/README.md) |
| Pi | [apps/pi-extension/README.md](apps/pi-extension/README.md) |
| Codex | [apps/codex/README.md](apps/codex/README.md) |

---

## How It Works

**Plan review** is automatic. Your agent enters plan mode, Plannotator hooks into the approval step:

```
Agent proposes plan → browser opens → you annotate → approve or deny with feedback
```

**Code review** is on demand:

```
/plannotator-review              # review uncommitted changes
/plannotator-review <pr-url>     # review a GitHub or GitLab PR
```

**Annotate** anything — files, folders, URLs, or the agent's last message:

```
/plannotator-annotate <file|folder|url>
/plannotator-last
```

---

## Integrations

| Integration | Description |
|---|---|
| **[VS Code](https://marketplace.visualstudio.com/items?itemName=backnotprop.plannotator-webview)** | Open plans in editor tabs, view diffs inline, sync annotations as editor decorations |
| **Obsidian** | Auto-save approved plans to your vault with frontmatter, tags, and graph backlinks |
| **Bear** | Save plans with nested tags and project metadata |
| **GitHub / GitLab** | Review any pull request by URL with full diff annotations |

---

## Development

```bash
bun install

bun run dev:hook       # Plan review server
bun run dev:review     # Code review editor
bun run dev:marketing  # Marketing site
bun run dev:vscode     # VS Code extension
```

See [CLAUDE.md](CLAUDE.md) for build instructions, project structure, and architecture details.

---

## License

Copyright 2025-2026 [backnotprop](https://github.com/backnotprop)

Dual-licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT) at your option.

Contributions are dual-licensed under the same terms unless you explicitly state otherwise.

---

<p align="center">
  <a href="https://plannotator.ai">plannotator.ai</a> &middot; <a href="https://plannotator.ai/docs/">docs</a> &middot; <a href="https://github.com/backnotprop/plannotator/releases">releases</a>
</p>
