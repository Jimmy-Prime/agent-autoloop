# Daily morning brief
[简体中文](README.md) | [繁體中文](README.zh-TW.md) | **English**

## What it does
Each morning, it gathers the notes and commits in the current directory and writes `briefs/YYYY-MM-DD.md`. It does not use the network.

## How to turn it on
Copy this directory's `SKILL.md` to `~/.codex/skills/morning-brief/`. For Claude Code, use `~/.claude/skills/morning-brief/`.
Merge `agents` and `rules` from `rules.json` into `~/.agent-autoloop/rules.json`, then check:
```bash
agent-autoloop check
```
The rule takes effect within a few seconds. Set cron to `* * * * *` for a while and you can try it within one minute.

## What to change
- Change `worker` to the worker computer shown by `agent-autoloop status`. Set `use` to `codex` or `claude`.
- Change `cwd` to a notes directory you already have. `cron` is local time. The default is 8:00 every day.
- Permissions: `edit`. Both plugins can read local data and write the brief. They do not need the network or arbitrary shell commands. See the [permission guide](../../../docs/plugins.en.md#what-access-actually-allows).
