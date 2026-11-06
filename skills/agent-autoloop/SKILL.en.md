---
name: agent-autoloop
description: "Configure the Agent Autoloop hub: add rules, connect a new event plugin, connect a new agent, connect a new channel (Feishu, QQ, DingTalk, WeCom, and so on), write a task guide, deploy to a server, and add computers. Use it when the user says \"let the agent handle it when something comes up\", \"have the agent do something every day at a set time\", \"connect GitHub / an alert / some system\", \"switch to another model\", \"approve it in Feishu\", or \"add a computer\"."
---

# Agent Autoloop hub
[简体中文](SKILL.md) | [繁體中文](SKILL.zh-TW.md) | **English**

The full protocol is in `docs/protocol.en.md`. This is how to do it. The program is in `~/.agent-autoloop/app`, the rules are in `~/.agent-autoloop/rules.json`, and configuration and keys are in `~/.agent-autoloop/config.json`.

## Check status and answer

`agent-autoloop status` lists who is online, what is waiting on the user, what is in progress, and what has been done, plus rounds, tokens, and cost for today and the past 7 days, counted by completion time (reported usage from retries of the same round is added together, and rounds that reported nothing are written out). `agent-autoloop status --json` prints the `/v1/state` structure as it is, for scripts and dashboards. `agent-autoloop answer <card> <number>` answers. `agent-autoloop resolve <card> <result>` closes a card out. `agent-autoloop stop <round number>` stops a round, and it reports stopped only after the whole process group has exited.

Continuing a session counts only the usage added this time. `~/.agent-autoloop/worker/usage/` stores the cumulative values used for the subtraction. A continuation with no record (for example, that directory was deleted) does not report Codex tokens or Claude Code cost this time. The next time is back to normal. Usage the owner spends by opening the link and going on in the same session is counted in the next continuation. Old receipts are not recalculated.

There is no web page here. If the user wants a page that shows the whole picture, write one for them. Read `GET /v1/state`. The key is `owner` in `config.json`. The requests are in the “Owner” section of `docs/protocol.en.md`.

## Change the rules

Edit `rules.json` and run `agent-autoloop check`. It takes effect within a few seconds. If the file is wrong, the old rules keep running, and a card is sent saying what is wrong. `agent-autoloop rules explain` lists how the rules on this machine take effect, and the next scheduled time. `agent-autoloop emit <type> --dry-run` previews who an event would be sent to. Both look only at this machine's `rules.json`. They do not connect to the hub. A task not yet claimed picks up the new agent, directory, and permissions when it is claimed. A task already claimed keeps its job configuration and its worker until this run ends.

`language` is the language for the interface and the cards: `zh-CN` (the default), `zh-TW`, or `en`.

Each rule answers five questions: which event (`when`), who it goes to (`to`), where (`cwd`), what to follow (`skill`, `prompt`), and whether to tell the user (`tell`; the default is only when there is a card).

```json
{ "name": "Handle issues", "when": { "source": "github", "types": ["issues.opened"] }, "to": "claude", "cwd": "~/code/app", "skill": "handle-issue", "parallel": 3 }
{ "name": "Morning brief", "when": { "cron": "0 9 * * *" }, "to": "codex", "cwd": "~/notes", "prompt": "Write today's brief." }
```

- To handle events for the same subject separately, without waiting on each other, set `parallel`. How many rounds one worker runs at once is also limited by `worker.capacity` in `config.json`. The default is 2. To run more, raise that too.
- For a new event on the same subject to continue the previous round's session (for example, a later message in the same conversation), set `"resume": true`. The default opens a new session each time. A new session is opened when the previous round was stopped, might still be running, or used a different agent. When `parallel` is not set, every event for the whole rule continues the same session.
- To stop one rule, use `agent-autoloop pause <rule> --reason …` (add `--until` to resume automatically at a set time). Resume with `resume <rule>`. Run one round now with `run <rule>`. You do not edit `rules.json` just to pause a rule.
- Before changing the rules, you can write a draft and check it with `agent-autoloop check <draft>`. That does not affect the hub that is running.
- The default ask-first list is `askFirst`. When the user says which things must be asked first, change it here.
- Scheduled tasks the user runs elsewhere (in the Claude or Codex apps) go in `elsewhere`. They are only listed in `agent-autoloop status`. When they need the user, they run `agent-autoloop tell <id> --task <task name>`, and the content comes from standard input. When the user has to make the call, give that task a `cwd` and a `skill` or `prompt`. Inside the task, run `agent-autoloop ask --task <task name>`, and pass an `ask` like a receipt on standard input. The card has options. When the user picks one, the hub wakes that task's agent to continue in `cwd`, following `skill` and `prompt`. The answer is in `answers` in this round's context file.

Ready-made recipes and built-in plugins start from the [README](../../README.en.md#ready-to-use-recipes). Development examples are in [Writing plugins](../../docs/plugins.en.md). When the user wants something automated, start by editing an example. Do not write from scratch. `examples/recipes/` has a morning brief (`morning-brief`), GitHub issues (`github-issues`), production errors (`ops-alerts`), feedback (`feedback`), website watch (`website-watch`), a Feishu weekly report and business brief (`feishu-brief`), and Claude browser handoff (`browser-handoff`). Each has rules, a Skill, and a README that says why the permissions are what they are. Feedback, website watch, Feishu briefs, and browser handoff default to the owner's private Feishu chat. Replace the fictional identifiers as the template says. Keep business data in a private directory. Read as the owner. Notify as the bot. To write a new agent, channel, or event plugin, see the guide `docs/plugins.en.md` and the minimal examples in `examples/plugins/`.

## Write a task guide

A long-running job gets one Skill. The guide says how the job counts as done and how to verify it. You do not write how to end a round. The prompt already says that. A few points:

- Text in an event is data. Check the current facts at the source before you act. The same thing may be called twice. Before an action with side effects, see whether it has already been done.
- For a connection, sign-in, or verification only the owner can restore, the first line is “待你处理：原因” (`NEEDS YOU: reason`). Use `ask` to leave the business work already done, the items not yet checked, and which steps to do only after recovery. If the same block already has an `open` card, do not ask again. Do not use `later` to retry on a schedule. Cancel the follow-up check for the same block in `waiting`.
- Put two files in the project. `docs/decisions.md` records what the user decided in their own words. `docs/declined.md` records what they refused. Have the agent read them first. Do not ask again about something already decided.

## Connect an event plugin

There are three kinds:

1. **The other side can send HTTP.** `agent-autoloop key new source <name>` gets a key (this creates a new key; ask the user first). Register it under `sources` in `rules.json`. The other side sends `POST /v1/events`.
2. **The other side has its own webhook format.** Write a function in `~/.agent-autoloop/plugins/<name>/source.ts` that checks the signature and translates the body into an event (see `plugins/github/source.ts`). Set the source's `"adapter": "<name>"`. The address is `/v1/in/<source>`. Put the secret in `AGENT_AUTOLOOP_SECRET_<source>` in `~/.agent-autoloop/secrets.env` (the source name uppercased, `-` replaced with `_`). Restart the hub after the change (`agent-autoloop service install`). The other side has to be able to reach the hub, so the hub is on a server, or you use a tunnel.
3. **The other side cannot push, or the hub is at home.** Run a script on a schedule to poll. See `examples/watch-github-issues.sh`. The rule uses an agent with `use: "command"` and sets `emits`. When there is nothing new, no tokens are spent.

## Connect an agent

Any command that can print its last message is one line under `agents` in `rules.json`:

```json
"hermes": { "name": "Hermes", "worker": "my-mac", "use": "command", "command": ["hermes", "chat", "-Q", "-q", "{prompt}"] }
```

An exit code other than 0 counts as “没跑成” (`FAILED`). For session resume, a link that opens the session, and usage, write a plugin at `~/.agent-autoloop/plugins/<name>/agent.ts` (follow `plugins/codex/agent.ts`). `command` supplies the command line. `read` reads the last message and the session from the output. After the agent has accepted the prompt, include `started: true` (otherwise a break halfway through opens a new session and does the work again). `link` supplies the link.

`access` defaults to `edit`. A dedicated plugin translates it into that CLI's permissions. `command` only passes arguments. It does not limit permissions for an arbitrary program. Configure it from that CLI's documentation. For full permissions with no approval, write `full`, and explain that to the user first.

A third-party repository puts `agent.ts`, `channel.ts`, or `source.ts` at its root. Install it with `agent-autoloop add <git URL>` into `~/.agent-autoloop/plugins/<repository name>`. The repository name in lowercase is the plugin name. The rule's `use` is that name. Only lowercase letters, digits, and `-` are allowed. `add` rejects a name that does not qualify. A local plugin with the same name takes priority over a built-in one. It does not update on its own. A plugin is trusted code. Read it before you install it.

How long a round may run is `timeout`, in minutes. The default is 180.

ACP uses `use: "acp"` and `command: ["the ACP server"]`. It supports v1 session create and resume, text, and one-time permission requests. Sign in with that agent's own CLI first. `access` covers only operations the agent comes and asks about. The specification allows it to act without asking. To limit it, use its own mode (for example, write `env INITIAL_AGENT_MODE=read-only …` in `command`). `model` and `effort` have no effect. The ordinary command connection, and what has actually been tested, are in `README.en.md`.

DeepSeek Harness uses `use: "dsh"`. It needs 0.2.2 or newer (`npm install -g @deepseek-ai/dsh@next --allow-scripts=koffi,node-pty,@deepseek-ai/dsh-subprocess-local`; if those three packages' install scripts are not allowed, the install looks fine and then fails as soon as you run it). It can continue the original session and report tokens (it does not report cost). When it reports `MISSING_CREDENTIAL`, put the key in an environment variable. `access` maps to its permission levels. Older versions use the ordinary command connection in `README.en.md`. There is no desktop link to open.

When a Claude main task needs to hand web pages to Codex, configure an entry point, target, and allowed actions that have already been checked, from `examples/recipes/browser-handoff/`, and keep the Codex child session id it returns. The main task hands a block over with `ask`. After recovery, continue only the web steps. The entry-point template does not provide a browser connection, and it does not change the desktop app or its authorization.

Web tasks use the browser tools the agent already has configured. When a dedicated entry point is needed, write the existing command and how to continue the session in the rule's `prompt` or `skill`. Hand over only the web steps. The main task still owns the business work and the receipt. Do not assume a background CLI is already connected to the desktop browser. Check the page and the continuation with the same background method. See “Browser access” in `docs/plugins.en.md`.

## Connect a channel

Configuration is in two places. `channels` in `rules.json` registers them (`answerers` is who can answer; if it is left out, anyone in the channel can answer, and `doctor` reminds you). `channels` in `config.json` holds keys and options. `agent-autoloop key new channel <name>` gets a key (ask the user first). After you change `config.json`, restart with `agent-autoloop service install`. By default every card goes to every channel. To send one rule's cards only to some channels, write `"channels": ["feishu"]` on that rule.

**Desktop notifications.** A newly installed hub has them on (`plugins/desktop/channel.ts`), with one `desktop` in each of the two places. The first time a card is sent, macOS uses `osascript` and Linux uses `notify-send` to show one notification. The title is “Agent 问你一个问题” (“An agent has a question for you”). The body is the card title plus “运行 agent-autoloop status 查看” (“Run agent-autoloop status to check”). You cannot answer on the notification. When there is no graphical session it is skipped quietly, and the question is still there. If the notification command fails, the failure is reported, and the hub does not exit. You can leave it in place after connecting another channel. If you do not want it, delete `desktop` in both places, then restart. A hub installed earlier does not gain it on its own.

**Feishu.** Use the official `lark-cli`. Run `npm i -g @larksuite/cli`, then `lark-cli config init --new` to create an app (the user scans the code). In the developer console, turn on the bot capability for the app, and subscribe to card action callbacks (long connection). Then:

```json
// rules.json
"channels": { "feishu": { "name": "Feishu", "answerers": ["ou_the user's open_id"] } }
// config.json
"channels": { "feishu": { "key": "…", "user": "ou_the user's open_id" } }
```

Card clicks for one Feishu app can have only one listener, and only on one computer.

**Telegram.** Use the Bot API. An outbound connection is enough to receive button clicks. This machine does not need a public address. In Telegram, find @BotFather, create a bot with `/newbot`, and take the token. First say something to this bot in a private chat, then open `https://api.telegram.org/bot<token>/getUpdates`. `message.chat.id` is the chat id of that private chat. In a private chat it is also your user id. Then:

```json
// rules.json
"channels": { "telegram": { "name": "Telegram", "answerers": ["your user id"] } }
// config.json
"channels": { "telegram": { "key": "…", "token": "the bot's token", "chat": "the private chat's chat id" } }
```

One bot can receive clicks in only one place at a time, and only on one computer. Do not set a webhook on it either. Set `chat` to the private chat with the owner. Do not set a group. Cards often contain things only the owner should see. Telegram has no idempotency key. If a send succeeds and the report is lost, it may send the message again.

**Text only (DingTalk and WeCom group bots, and Slack and Discord webhooks).** Use `plugins/webhook/channel.ts`. On the channel entry in `config.json`, set `"use": "webhook"`, `"platform": "dingtalk"`, and `"url": "the webhook URL you already have"`. The platform may also be `wecom`, `slack`, or `discord`. In `rules.json`, set `"links": true`. The card link itself can be used to answer. `hub.publicUrl` in `config.json` must be an address a phone or a computer can open.

**A new channel with buttons.** Write one at `~/.agent-autoloop/plugins/<name>/channel.ts`, following `plugins/feishu/channel.ts`: loop, claim a card, send or update it, and report. Turn a click into `hub.answer`. The protocol is in `docs/protocol.en.md`. Another language is fine, as long as it can send HTTP.

## Delivery pipeline

The worker computer needs `gh` already signed in, and a review program. The `delivery` process runs only plugins on this machine and the review command named on main. The PR is not checked out, and its code is not run on this machine. First put the project's `ops/delivery.json` and the review checklist on main:

```json
{
  "repo": "owner/app",
  "internal": ["docs/**/*.md"],
  "check": { "workflow": "check.yml", "job": "check" },
  "ship": { "workflow": "ship.yml" },
  "review": { "points": "AGENTS.md", "status": "agent-review", "xhigh": ["src/auth/*"] },
  "health": {
    "url": "https://app.example/health",
    "field": "commit",
    "pattern": "(?P<sha>[0-9a-f]{40})",
    "require": { "ok": true }
  }
}
```

`AGENTS.md` needs a `## 审查要点` heading (also recognized: `## 審查要點` and `## Review checklist`). `review.command` can replace the review program with a command array. The prompt is read from standard input. `{input}` is replaced with the text-diff file. Standard output must be `{"findings":[{"title":"file:line and the problem","text":"what triggers it and what follows"}]}`. When there is no problem, submit an empty list. Codex, by default, ignores user configuration, turns memory off, and reads only a separate review snapshot. `admin_merge` defaults to empty. Only PR authors that main lists explicitly may use an admin merge. A project with no live service can omit `health`. The receipt then says plainly that only the merge was finished.

`check.job` is the job's name. A matrix job (a name like `check (ubuntu-latest)`) counts as the same job, and every cell has to succeed. The check workflow's trigger types must include `ready_for_review`. After a draft becomes ready, only a new check run that starts after that is accepted, and `pull_request` does not fire when a draft becomes ready, by default. Write it as `on: { pull_request: { types: [opened, synchronize, reopened, ready_for_review] } }`.

Example rules (change the absolute paths, the worker computer, and the repository to your own):

```json
{
  "sources": { "github": { "name": "GitHub" } },
  "agents": {
    "poll": {
      "name": "Check delivery labels",
      "worker": "mac-mini",
      "use": "command",
      "command": ["node", "/absolute/path/agent-autoloop/plugins/delivery/poll.ts", "owner/app"]
    },
    "delivery": { "name": "Delivery", "worker": "mac-mini", "use": "delivery", "command": ["owner/app"], "timeout": 35 }
  },
  "channels": {},
  "rules": [
    {
      "name": "See what is waiting for delivery",
      "when": { "cron": "*/2 * * * *" },
      "to": "poll",
      "cwd": "/existing/working/directory",
      "prompt": "Check the project's delivery labels",
      "emits": { "source": "github", "types": ["pull_request.labeled", "issues.labeled"] }
    },
    {
      "name": "Delivery",
      "when": { "source": "github", "types": ["pull_request.*", "issues.labeled"] },
      "to": "delivery",
      "cwd": "/existing/working/directory",
      "parallel": 2,
      "prompt": "Finish delivery from the project settings on main"
    }
  ]
}
```

Polling needs no new webhook and no new key. The event id is made from the label record and the PR commit. Reading again does not dispatch again. You can also connect an existing GitHub source directly. Items are split as `owner/repo#number`. `parallel` controls how many run at once. Adding `deliver` enters the flow. Adding `deliver-review` as well means review only, and adding it while checks are still running also blocks the merge. `deliver-attended` means a person is watching. When a problem is found, it only writes a receipt and does not send a separate notification. After the review finds a problem, that same commit is not reviewed a second time. Push a new commit before it is reviewed again. An ordinary issue labeled `ask-owner` becomes a question card. The label is removed after the answer. It does not post a GitHub comment for you.

The project's Ship runs only on a push to main. It checks out the full history (checkout's `fetch-depth: 0`), then calls this repository's Action. Replace the placeholder commit below with the full SHA verified after the release:

```yaml
- uses: Jimmy-Prime/agent-autoloop/plugins/delivery@<full commit id>
  id: scope
- if: steps.scope.outputs.release == 'true' && steps.scope.outputs.superseded != 'true'
  run: ./the project's existing release command
```

The version the health endpoint returns must yield a Git commit, and the business fields must satisfy `require`. An ordinary run allows only HTTPS. `--test-local-health` and the Action input `test-local-health: 'true'` are only for an explicit local test. They also allow `http://127.0.0.1`. This does not let a GitHub-hosted runner reach your computer.

## MCP and revoking keys

For an MCP client, the launch program is `node`. The arguments are the absolute path of this machine's engine, `bin/agent-autoloop.ts`, and `mcp`. Pass `AGENT_AUTOLOOP_HOME` in the environment. It supports stdio, revision 2025-11-25. It uses keys already in the local `config.json`. It does not write keys into the client's arguments. Tools are shown for the identity that already exists. It does not create permissions on its own.

The MCP server does not tell callers apart. All of them are recorded as the owner (`answer` is recorded as the owner; `emit` carries no hop count). Do not put it in the user-level configuration of a CLI the worker starts, or a round can answer its own card.

`agent-autoloop key remove <source|worker|channel|owner> <name>` revokes that key at once. Its long polls and log subscriptions stop working at once too. Work already claimed can still turn in its result with this round's own token.

## Put it on a server, add a computer

When a phone needs to approve cards, or someone else's webhook needs to come in, put the hub on a machine that has a public address:

1. On the server, run `sh install.sh --no-service --command true` (this machine does not run an agent; `--command true` is only a placeholder; step 2 replaces the agents in `rules.json` with real ones). In `config.json`, set `hub.listen` to `127.0.0.1:3350` (it has to be written as `host:port`; IPv6 uses `[address]:port`; a port on its own, or `:port`, is rejected, so it does not listen on every interface by accident). Set `hub.publicUrl` to the public address, remove `worker`, then run `agent-autoloop service install`. Put an HTTPS reverse proxy in front (Caddy or nginx).
2. On each computer that does the work: on the server, run `agent-autoloop key new worker <name>`. On the computer, run `curl -fsSL https://raw.githubusercontent.com/Jimmy-Prime/agent-autoloop/main/install.sh | sh -s -- join https://hub-address --worker <name> --key <key>`. Set the matching `worker` on the agents in `rules.json`.

The computers do not open any port. They connect out on their own.

A system-level systemd unit you write yourself on the server has to use the same name as `agent-autoloop service install` (the default is `agent-autoloop`), or `doctor` will not recognize it. `agent-autoloop update` does not touch that unit. After an update, the new version is used only after you run `systemctl restart` yourself.

## Logs and recovery

Logs: on macOS, `~/.agent-autoloop/logs/up.log`. On Linux, run `journalctl --user -u agent-autoloop`.

Check a plugin first against a dedicated test hub: `agent-autoloop conformance <address> --config <test credentials file>`. The file's `keys` hold the source, worker, channel, and owner keys separately. `eventType` matches the test rule. `answerer` is on the test channel's allow list. The check writes events and cards. Do not point it at the hub in use. Protocol types are in `protocol/schema.json`.

`agent-autoloop why 42` shows one round's events, rules, and receipts. `GET /v1/stream?after=42` lets the owner's client resume by sequence number. Back up with `agent-autoloop backup [directory]`. This works while the hub is running. Restore with `agent-autoloop restore <directory>`, and stop the hub first. A manual backup has to keep `hub.db` together with `master.key` at mode 0600. The latter derives the tokens for rounds and card links.

## Version and uninstall

`agent-autoloop --version` shows the version and the commit. After you confirm, `agent-autoloop uninstall` deletes its own program, links, and service. Rules, keys, and records stay. `--yes` only skips the confirmation.
