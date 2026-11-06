# Have Claude hand the browser to Codex
[简体中文](README.md) | [繁體中文](README.zh-TW.md) | **English**

The main task handles the business work. Codex only handles the web page. The main task wraps up after it has the evidence. Later actions in the same browser session are supported. When the owner has to restore a connection, sign in, or verify, this round ends, a Feishu card is handed back, and it continues after the owner answers.

## How to turn it on

1. Copy this directory to `~/.agent-autoloop/work/browser-handoff/`. Only the owner can read it. Put `SKILL.md` in `~/.claude/skills/claude-browser-handoff/`. If the main task is switched to Codex, put the Skill in `~/.codex/skills/claude-browser-handoff/` and change the rule's `use`. The default is still a Claude main task.
2. Configure a **Codex entry point that can already use a browser**, and put its real command array in `browser.json.command`. If `codex-browser` is already on this machine, put its absolute path. `/path/to/browser-entry` is a placeholder. This template does not install a browser bridge, does not change a desktop app's internal database, and does not copy one computer's SSH aliases, model tiers, or Chrome process-cleanup logic.
3. In `browser.json`, fill in the target URL, what to check, and the allowed actions. The default is a read-only check of `example.com`. It does not submit a form or send a message. `allowedActions` is the task scope for the agent, not a system sandbox. The owner, or the project's trusted maintenance rules, has to set that scope. It cannot be generated from an external event. Do not put login credentials in the configuration. Real business URLs and session ids stay in a private directory.
4. Merge `sources`, `agents`, `channels`, and `rules` from `rules.json`. Replace the worker computer, the directories, and the owner's Feishu open_id. Reuse the Feishu channel and key you already have. Do not open another event listener. Run `agent-autoloop check`.
5. Permissions: `edit`. This only means Claude's `acceptEdits` mode. **It does not guarantee that an arbitrary browser-entry command can run.** Check the permission to call it the same way the worker starts in the background. If the entry point is not allowed yet, set it up from the authorization the owner already has. Do not change it to `full` on your own. This field also does not grant the browser helper its action scope or its account permissions.

## What the browser entry point agrees to

The entry point takes one complete task argument: `browser-entry "web task"`. Continuing takes `browser-entry --resume <session ID> "follow-up task"`. It returns evidence from the actual page, what the actions did, and what blocked it, and it ends with `[Codex 会话 ID：实际编号]` (Codex session ID: the actual id). A different entry point should offer the same call and the same return.

`handoff.ts` only passes the trusted configuration as one argument. It keeps standard output, standard error, and the exit code. It does not retry, and it does not treat “the command started” as finished. An entry point you already have can run on the computer where the browser is, or it can hand the work on over SSH itself. Check first that that computer can open the target URL. A remote browser cannot treat this machine's `localhost` as the worker computer.

Codex in the background, [`codex exec`](https://developers.openai.com/codex/noninteractive/), can use [MCP tools](https://developers.openai.com/codex/mcp/) it has configured. That does not mean it has the desktop app's Chrome connection. Installing the Codex CLI is not enough. The entry point you chose has to be checked for real. This template is a way to hand off a task. It is not a browser-connection driver.

## Check before you turn it on

From the template directory, run:

```bash
node handoff.ts browser.json
node handoff.ts browser.json --resume <the actual session ID returned by the previous step>
```

The first time, check the real page title, the visible main heading, and the links. If the page has no main heading in the body, record that as it is. The second time, check that it continued in the original session. If the work is already done, it should return the evidence it already has, and it should not redo the actions just to continue. Check that it kept the tabs that were already open and closed the tabs it opened itself. Then call the same script the way Claude starts in the background, and confirm it really received the evidence and the session id. An HTTP query cannot stand in for checking the page.

On a dedicated test hub, send a `browser.verify` event with a stable id to the source `browser-tasks` and that is enough to start it. A repeat of the same request keeps the `id`, for example:

```json
{"id":"browser-check-1","type":"browser.verify","subject":"site-check","summary":"Check the configured page"}
```

The event does not carry the entry command, the target path, or permissions. A block that needs the owner is ended with the `ask` in the Skill. When a card already exists, do not hand off again, and do not schedule a separate follow-up check. After the owner answers, continue only the web steps that are not finished.

## Drop it into work you already have

Feedback handling, website watch, and similar tasks can load this Skill directly. Put this directory's `handoff.ts` and the `browser.json` the owner configured into that task's private working directory, and write the location into the trusted main-task rule. You do not need a second scheduler. The main task finishes the business work it can do, then hands off the page check, then returns a receipt to the hub. The browser helper does not delegate again, and it does not close the item on its own.

The automated checks use a fake browser entry point. They check that arguments are passed through, that a session can be continued, and that a failure is passed on. They do not start a real Chrome. The published sample contains only an example URL and placeholders. Each person still has to check their own browser connection and Claude's permission to call it.
