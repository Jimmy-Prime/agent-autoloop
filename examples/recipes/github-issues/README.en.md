# Follow up on GitHub issues
[简体中文](README.md) | [繁體中文](README.zh-TW.md) | **English**

## What it does
Every five minutes it reads new issues, edits the code locally, and notifies you to look. It does not commit, push, or reply to the issue.

## How to turn it on
Copy this directory's `SKILL.md` to `~/.codex/skills/handle-issue/`. For Claude Code, use `~/.claude/skills/handle-issue/`.
Merge `sources`, `agents`, and `rules` from `rules.json` into `~/.agent-autoloop/rules.json`, then check:
```bash
agent-autoloop check
```
The worker computer needs `gh` already signed in. The polling script also hands the issue body to the agent.

## What to change
- Change both `worker` values to the worker computer. Set `use` to `codex` or `claude`.
- Change `owner/repo` to the repository, and change `created:>=2026-11-04` to the date you turn this on. Change `cwd` to a clean project directory.
- Permissions: `edit`. The agent only reads the data and edits local files. The network fetch is done by the fixed polling script, which is not limited by `access`. Claude does not allow arbitrary test commands by default. See the [permission guide](../../../docs/plugins.en.md#what-access-actually-allows).
