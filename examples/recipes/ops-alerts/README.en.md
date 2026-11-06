# Follow up on production errors
[简体中文](README.md) | [繁體中文](README.zh-TW.md) | **English**

## What it does
After an error arrives, it looks for the cause against the local code. If a restart is needed, it sends you a card. The sample restart script only prints text.

## How to turn it on
Copy `SKILL.md` to `~/.codex/skills/ops-alerts/`. For Claude Code, use `~/.claude/skills/ops-alerts/`, and put `restart.sh` in the service's code directory.
Merge `rules.json` into `~/.agent-autoloop/rules.json`, including `askFirst`. Run `agent-autoloop check`, then `agent-autoloop key new source shop` to get `$SHOP_KEY`.
The error system sends events with its own source key:
```bash
curl -fsS http://127.0.0.1:3350/v1/events -H "Authorization: Bearer $SHOP_KEY" -H 'Content-Type: application/json' -d '{"id":"checkout-20261104-0310","type":"alert.error","subject":"checkout","summary":"Checkout error","detail":"TypeError: price is undefined at src/cart.ts:42"}'
```

## What to change
- Change both `worker` values and `cwd` to the worker computer and the code directory. Set `use` to `codex` or `claude`.
- Permissions: `read`. It only reads the code and the stack trace attached to the event. It does not need the network. Claude's plan mode is a tool-approval rule, not a system sandbox. See the [permission guide](../../../docs/plugins.en.md#what-access-actually-allows).
- Replace `restart.sh` with your fixed restart and health-check command. Before sending across computers, set the address from the [configuration manual](../../../skills/agent-autoloop/SKILL.en.md#put-it-on-a-server-add-a-computer).
- Do not create an external source key for `shop-fix`. The restart script is not limited by `access`. Whether consent was given is checked by the Skill. It cannot be treated as a forced approval.
