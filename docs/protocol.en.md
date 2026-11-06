# Protocol
[简体中文](protocol.md) | [繁體中文](protocol.zh-TW.md) | **English**

The whole system is one loop with three entry points.

```
           Events                  Claim work
  Source ─────────▶  Hub  ◀──────────── Worker ── Agent
                     ▲ │
             Answers │ │ Cards
                     │ ▼
                   Channel ◀──▶ You
```

**The hub's kernel never connects to anything on its own.** Sources, workers, and channels connect in. The kernel does not need to know where they are, what language they use, or which product they belong to. It does not hold their credentials. Your computer does not need any open ports. The protocol is the HTTP + JSON described below. To write a new plugin, you only need to send HTTP requests.

On one computer, a single command runs all three in one process. They still use this same protocol between them.

**The hub has no UI.** You interact with it through channels and the CLI. To build a page or a large display, use the requests in the “Owner” section. It is a client on the same footing as the CLI.

## Six terms

| Term | Meaning |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Event** | Something happened: a source, ID, type, subject, one-line summary, details, and a link back. A scheduled time is an event. Clicking a card is an event too. |
| **Rule** | Written in `rules.json`: which events go to which agent, in which directory, with which Skill, and when to tell you. |
| **Item** | Work for the same subject under the same rule. Events are grouped into items. Cards, follow-up checks, and sessions belong to items. Without `parallel`, the whole rule is one item. |
| **Round** | One execution: claim a batch of events, submit a receipt, then end. A round ends; an item continues. |
| **Receipt** | The agent's final message. Everything it wants the hub to do goes here and takes effect together in one transaction when the round ends. |
| **Card** | Something for you to read. A card with options is a question. Your choice becomes a new event and moves the item forward. A card without options is a notification. |

## Six principles

1. **Your attention costs the most.** Stay quiet by default. Say nothing when there is nothing to do, and finish what can be handled alone. Interrupt you only for actions the rules say to ask about first or for blockers only you can clear.
2. **Everything is an event.** External systems, time, follow-up checks, and your decisions all take the same path.
3. **Everything connects in.** The kernel makes no outbound requests. Credentials stay where they are used, keeping the impact of a failure there too.
4. **An agent is a process.** Give it a prompt; it prints a final message. Claude Code, Codex, any CLI agent, a script, or a CI pipeline all work the same way. No SDK is needed. A process that starts remote work must follow it through to actual completion before exiting.
5. **A round never waits for a person.** To ask you, end the round. Start processing again after your answer, resuming the original session when possible. Waiting uses no agent process or tokens, and survives restarts.
6. **Rules are instructions.** Events cannot choose the agent, directory, Skill, or permissions. Only rules decide those. Text written by others never goes into the prompt. It goes into a file marked as data. This cannot stop every prompt injection, but limits the worst outcome to the scope the rule allows.

## Rules

```jsonc
{
  "timezone": "Asia/Shanghai", // Time zone for schedules and "today"; defaults to the system time zone
  "language": "zh-CN", // Language for the interface, cards, and agent prompts: zh-CN (default), zh-TW, or en
  "askFirst": ["Delete data", "Stop services", "Spend money", "Send messages to others"], // The agent asks you first only for these kinds of actions
  "sources": { "shop": { "name": "shop" }, "github": { "name": "GitHub", "adapter": "github" } },
  "agents": {
    "claude": {
      "name": "Claude Code",
      "worker": "mac-mini",
      "use": "claude",
      "model": "…",
      "effort": "high",
      "access": "edit",
    },
    "cursor": {
      "name": "Cursor",
      "worker": "mac-mini",
      "use": "command",
      "command": ["agent", "-p", "--trust", "{prompt}"],
    },
  },
  "channels": { "feishu": { "name": "Feishu", "answerers": ["ou_xxx"] } },
  "rules": [
    {
      "name": "Handle alerts",
      "when": { "source": "shop", "types": ["alert.*"] }, // Or { "cron": "0 9 * * *" }
      "to": "claude",
      "cwd": "~/code/shop",
      "skill": "run-ops",
      "prompt": "Follow the … section in it.",
      "group": "ops", // One round at a time per group; defaults to the rule name
      "parallel": 3, // When set, split items by subject: one round per subject, at most 3 rounds in this group, also limited by the worker's worker.capacity (default 2)
      "resume": true, // New events for the same item continue the previous round's session; default is a new session each time
      "tell": "needed", // always: notify after every successful round (except 没事可做 (NOTHING) or 没跑成 (FAILED)) / needed: only when there is a card (default) / never: suppress only receipt notifications; questions and the hub's own alerts still go out
      "emits": { "source": "shop", "types": ["pr.*"] }, // Events the receipt may emit; none if omitted
      "channels": ["feishu"], // Send this rule's cards and notifications only to these channels; all channels if omitted
    },
  ],
  "elsewhere": [
    {
      "name": "Weekly cleanup",
      "source": "shop",
      "to": "claude",
      "cron": "0 6 * * 0",
      "where": "Scheduled tasks in the Claude app",
      "cwd": "~/code/shop",
      "skill": "weekly-sweep",
      "prompt": "Follow the 'When the answer arrives' section in it.", // Optional: set this if it needs to ask you; after your answer, continue here following these instructions
    },
  ],
}
```

`language` sets the language of the hub's own text: cards, errors, CLI output, and card pages. It is also sent to the worker in each round's Job, so the agent uses that language for conclusions and cards. Cards carry it too, so channels use it for their own text. When omitted, it is Simplified Chinese, as before. Existing cards in the log keep their original text. They are not rewritten. `agent-autoloop init --language zh-TW` (or the `AGENT_AUTOLOOP_LANGUAGE` environment variable) sets it in a new `rules.json`. For a new installation through the install command, the computer's `LANG` decides: `zh_TW`, `zh_HK`, and `zh_MO` select Traditional Chinese, other Chinese locales select Simplified Chinese, and all others select English. Older plugins and clients can ignore this unknown field.

`elsewhere` lists scheduled tasks run somewhere else. The hub does not start them; it only lists them in `agent-autoloop status`. They use `POST /v1/tell` when they need to tell you something. Tasks with `cwd` (and either `skill` or `prompt`) can also ask you questions. Their cards have options. After you answer, the hub wakes `to`, as it would for a rule's round, and continues in `cwd` following `skill` and `prompt`. The group is the task name, with one round at a time. It does not resume the scheduled task's own session. If the rules are invalid, file changes do not take effect. The previous rules keep running, and a card tells you what is wrong.

With `resume`, a round resumes the item's previous session if the previous round finished (including with nothing to do) and left a session. Sessions grow as they continue, and tokens and cost grow with them. A new session starts in these cases: the previous round was stopped, either by you or after repeated failures, since continuing it would likely give the same result; a different agent ran the previous round; or it left no session. Without `parallel`, the whole rule is one item, so all events share one session. Events without `subject` also count as one item. Answers and due follow-up checks still return to the session where the question or check was set up. Retries stay in their own session too.

Whether or not `resume` is set, if another round in the intended session is unfinished, or has gone silent and may still be running, this round starts a new session. Two processes must not open the same session. The answer and follow-up check context are still passed along.

Queued tasks and tasks waiting for a retry use the latest agent, directory, prompt, and permissions together when claimed. If the agent changes, its predecessor's session is not carried over. Claimed tasks keep their Job configuration and worker from the time of claim. Repeated claims, heartbeats, stopping, and restart recovery do not switch workers with rule updates. Items that already own events are not split or merged again. Answers and due follow-up checks return to the item where the question or check was set up, even if `parallel` is later removed. Event permissions and notification behavior in receipts are still checked against the rules at submission time.

## Sources: turn the world into events

```
POST /v1/events                    Authorization: Bearer <来源的密钥>
{ "id": "12:new", "type": "feedback.new", "subject": "#12", "summary": "…", "detail": "…", "link": "https://…" }
→ 200 { "event": 34, "duplicate": false, "routed": ["Handle feedback"] }
```

- `id` and `type` are required. The same `id` from the same source is recorded only once, so sources can resend freely.
- `subject` must be an identifier: letters, digits, and `# . _ : / @ -`. `link` must be an ASCII-only URL, because both go into the prompt. `summary` and `detail` do not.
- Events with no matching rule are kept too. You can see them in `agent-autoloop status`.
- Field limits: `id` 200 characters, `subject` 100, `summary` 200, `detail` 4000, `link` 500, and `type` 64.

Three other ways in produce the same kind of event at the hub:

- **Schedules**: set `cron` in a rule. After missing times, for example while the computer's lid is closed, only the latest one is caught up on wake. A repeated time during daylight saving runs only the first time. A nonexistent time is skipped.
- **Third-party webhooks**: `POST /v1/in/<来源>`. If the source has an `adapter`, the function in `plugins/<adapter>/source.ts` verifies the signature and translates it into events. It only translates; it makes no requests. Put the signing secret in `AGENT_AUTOLOOP_SECRET_<来源>` in `secrets.env`, not in `rules.json`. Convert the source name to uppercase and replace `-` with `_`; restart the hub after changes.
- **Polling**: no public internet connection is needed, and nothing new means no tokens spent. A rule schedules a script, which is also an agent, and the script returns new events in the receipt's `events`. Event `id` values must be stable. Read ranges can overlap; the hub deduplicates. Advance the script's cursor only after submitting the receipt, or keep no cursor at all.

When a source or an `elsewhere` task has something to tell you directly, without agent processing:

```
POST /v1/tell    { "key": "weekly-44", "text": "…" }              Authorization: Bearer <来源的密钥>
POST /v1/tell    { "task": "Weekly cleanup", "key": "x", "text": "…" }   Authorization: Bearer <接单程序的密钥>
→ 200 { "card": 56, "duplicate": false }
```

This sends an information-only notification (`fyi`) with no buttons, once per `key`. When an `elsewhere` task with `cwd` needs your call, use `ask` instead of `key` and `text`. Its content matches `ask` in a receipt:

```
POST /v1/tell    { "task": "Weekly cleanup", "ask": { "title", "text", "options": ["…", "…"], "recommend": 0, "about": "…", "key": "…" } }
                                                                    Authorization: Bearer <接单程序的密钥>
→ 200 { "card": 57, "duplicate": false }
```

No new card is sent while one with the same `key` is still open; without a key, title and text are used. After you answer, the hub wakes the task's agent to continue in `cwd`, with your answer in the round's `answers`. Once done, the card changes to executed. Asking from a task without `cwd` returns 400. Older hubs do not recognize `ask` and return 400. When the hub and worker are deployed separately, upgrade the hub first.

## Agents: claim work, do it, submit a receipt

Each computer has a worker that only connects out. One worker can serve multiple agents.

```
GET /v1/work?claim=<这次领活的编号>&wait=50&running=7,8&capacity=1    Authorization: Bearer <接单程序的密钥>
→ 200 { "job": null | Job, "cancel": [7] }
```

- When there is no work, wait up to `wait` seconds. Return as soon as new work arrives. `running` lists the rounds currently running and also acts as a heartbeat. `capacity=0` checks in without claiming work.
- While holding work, the worker can ask for work and cancellations every second. Heartbeats enter the log at most once per minute, as one record regardless of the number of running rounds. Channel card polls work the same way. This means `/v1/state`'s `seenAt` can be less than a minute behind the last contact, and “not reported for 5 minutes” or “not connected for 10 minutes” may be judged less than a minute early. `online` allows for this minute: a worker counts as online for 3 minutes after the record.
- If the response is lost, retry with the same `claim` to get the same job.
- `cancel` lists rounds to stop. The worker first sends a stop signal to the entire process group. If any process is still running after 10 seconds, it kills the group. Only after confirming there are no live processes in the group does it submit `outcome: "cancelled"` and release the item. Restarting the worker during stopping continues this step. A `failed` result from a round being stopped also counts as stopped, with no retry.

```jsonc
// Job: everything for one round. The token is valid only for this attempt of this round.
{
  "run": 12, "token": "…", "attempt": 1,
  "rule": { "name": "Handle alerts", "cwd": "~/code/shop", "skill": "run-ops", "prompt": "Follow … in it." },
  "agent": { "id": "claude", "name": "Claude Code", "use": "claude", "model": "…", "effort": "high", "access": "edit" },
  "session": null,       // Session to try to continue: the last attempt's for a retry, the asking round's for an answer, or this item's previous round's with resume. Start a new one if unavailable; this is only an optimization
  "askFirst": ["Delete data", "…"],
  "language": "zh-CN",   // Language from the rules. Treat it as Simplified Chinese if an older hub omits it
  "context": {           // The worker writes this to a file for the agent. It is all data
    "events":  [{ "id", "source", "sourceName", "type", "subject", "summary", "detail", "link", "receivedAt" }],
    "answers": [{ "card", "title", "options", "choice", "text", "about", "by", "at" }],  // Decisions this round continues from
    "timers":  [{ "key", "about", "at" }],                                               // Follow-up checks due this round
    "waiting": [{ "key", "about", "at" }],                                               // This item's follow-up checks that are not yet due
    "open":    [{ "card", "title", "text", "at" }],                                      // Unresolved cards from the same source and group
    "decided": [{ "card", "title", "choice", "at" }]                                     // This item's past decisions, valid only for the work they concerned
  }
}
```

```
POST /v1/runs/12/started   Authorization: Bearer <token>   { "session": "…", "link": "claude://…" }
POST /v1/runs/12/result    Authorization: Bearer <token>   Result
→ 200 { "rejected": [{ "card": 9, "reason": "Outside this round's review scope" }] }
```

```jsonc
// Result
{
  "outcome": "done" | "nothing" | "failed" | "cancelled",
  "summary": "One-line summary", "error": "Reason the run failed", "session": "…",
  "usage": { "input": 0, "output": 0, "cached": 0, "cost": 0 },
  // The receipt below takes effect together in one transaction
  "ask":     [{ "title", "text", "options": ["…", "…"], "recommend": 0, "about": "Context for yourself when you continue", "key": "Stable name for this matter" }],
  "notice":  [{ "title", "text", "key", "fyi": true }],
  "resolve": [{ "card": 3, "reason": "Where resolution was verified" }],
  "later":   [{ "key": "…", "at": "2026-11-05T09:00:00+08:00", "about": "What to check then" }, { "key": "…", "cancel": true }],
  "events":  [{ "id", "type", "subject", "summary", "detail", "link" }]
}
```

- Results can be replayed. If the response is lost, resubmit the same content with the same token for the same acknowledgment. Different content returns 409.
- `failed` triggers a retry, so only `notice` takes effect; everything else is ignored. If you asked to stop the round, submitting `failed` does not retry it, and `notice` is ignored too.
- If you need to restore a connection, sign in, or verify your identity, end this round with `done` and submit `ask`, not `failed`. `done` means the round ended. The card keeps following the unfinished item; it does not mean browser verification is complete. Do not repeat a question when `open` already has a card for the same blocker, or schedule retries with `later`. Cancel existing checks for that blocker in `waiting` with `cancel`. Preserve completed business work, and state in `about` exactly which remaining steps to take after recovery.
- The worker reports `usage` for this attempt, including receipt rewrites in the attempt. Every field is optional: `input`, `output`, and `cached` are token counts; `cost` is in US dollars. The hub sums reported values across attempts in the same round. Duplicate submissions do not double-count cost. Unreported fields stay absent, rather than becoming zero. `agent-autoloop status` sums finished rounds for today and the past 7 days by completion time, and shows how many rounds did not report usage.
- Some agents provide only cumulative session values, such as Codex tokens and Claude Code cost. The worker subtracts the totals from before launch, so these values always describe this attempt. A resumed session without a prior record omits those fields; see the [plugin guide](plugins.en.md#agent-plugins).
- An `ask`'s `key` is scoped to this item. No new card is sent while one with the same `key` is open. Asking again after it closes creates a new one.
- `notice` accepts an optional boolean `fyi`. With `true`, it is information-only: the card is `closed` at creation, but is still delivered within 24 hours of creation. Feishu shows a gray card without a “Handled” button. It does not enter later rounds' `open`, and clicking it creates no answer event. When omitted or `false`, the notification has a “Handled” button and can also be closed with `resolve`. Because an `fyi` card is closed at creation, using the same `key` in the next round sends another card. A retry of the same round sends it only once. `tell: "never"` still suppresses it. Older hubs do not recognize this field and reject the entire receipt. When the hub and worker are deployed separately, upgrade the hub first.
- `resolve` can close only cards from the same source and group that existed before this round claimed work. Out-of-scope entries go into `rejected` without affecting the round's result.
- A `later`'s `key` is scoped to this item. Writing the same `key` again changes its time.
- The rule's `emits` decides the source of `events`. The receipt cannot change it.

### The agent only needs to do one thing

The worker gives the agent a prompt. The agent's final message is the receipt:

````
Put a one-line conclusion first. For a temporary failure that can be retried automatically, write “没跑成：原因” (FAILED: reason). For a blocker that needs you to restore access, write “待你处理：原因” (`NEEDS YOU:` reason; not read by the worker, only a marker for people) and submit ask. For nothing to do, write “没事可做：原因” (NOTHING: reason). Otherwise, end this round and use the receipt to keep following the item.

```agent-autoloop
{ "ask": [ … ], "notice": [ … ], "resolve": [ … ], "later": [ … ], "events": [ … ] }
```
````

The first-line markers “没跑成” (`FAILED`) and “没事可做” (`NOTHING`) also accept the Traditional Chinese forms “沒跑成” and “沒事可做”, and the English forms `FAILED` and `NOTHING`.

The code block is optional. The agent needs no installation or connection to the hub, so sandboxed and cloud agents can take work too.

An invalid receipt does not repeat the business work. The worker resumes the original session and asks only for a rewrite of the final message, at most twice. Agents without a session, such as `command`, do not rewrite and go straight to the following behavior. If the receipt is still unreadable, or the rewrite process fails to start, errors, times out, or produces no output, the original business message's first-line outcome is kept. The receipt is discarded, and a card tells you where to find the original output. Each round's output is kept for 14 days after it ends. A failed receipt rewrite does not turn completed business work into an automatic retry.

### Connect a new agent

Add one line to the rules. Any command that prints a final message works. A nonzero exit code counts as failure:

```json
{ "name": "Hermes", "worker": "mac-mini", "use": "command", "command": ["hermes", "chat", "-Q", "-q", "{prompt}"] }
```

For session resumption, a link to open the session, and usage reporting, write a file at `plugins/<名字>/agent.ts`; see `plugins/claude/agent.ts`:

```ts
export default {
  command: (run) => [...],                                         // Command line for this round; run.resume is the session to continue
  read: (output) => ({ text, session, usage, finished, started }), // Read the final message and session from output
  link: (session) => "…",                                          // Optional link to open this session
};
```

`started` means the agent has accepted this round's prompt. Keep returning it whether the round later finishes, errors, or loses its process. With it, a later error counts as failure, and the hub retries in the original session. Without it, failures while continuing an old session are treated as an unavailable session, and the prompt is run again in a new one. `finished` means the round has actually ended. If it has not exited after 30 seconds, stop it. A background task still running, with the agent expected to return and continue, does not count as finished.

Dedicated plugins translate the three `access` levels into their CLI's permissions: `read` is read-only, `edit` edits only the working directory (the default), and `full` gives full access with no approval. Read-only does not mean keys are unreadable. Use a system account or container to isolate keys. `command` only passes command arguments; it does not restrict arbitrary programs' permissions.

The agent's runtime environment provides the browser. Codex uses background `codex exec`; do not assume the desktop app's browser connection is automatically available. Use browser tools actually available to that round, or an entry point explicitly configured in the rules or Skill. That entry point handles only browser steps and resumes its own session. The main task still owns business work and the receipt. The hub includes no browser bridge and does not install or authorize browser tools. See the [plugin guide](plugins.en.md#browser-access) for integration verification.

## Channels: bring cards to you

A channel is a small program that connects out.

```
GET /v1/cards/next?wait=50    Authorization: Bearer <通道的密钥>
→ 200 { "card": null | Card }

// Card: how the card looks now. Content stays unchanged after creation; only state changes
{ "id": 56, "version": 2, "ref": null, "kind": "ask", "state": "open",
  "title": "…", "text": "…", "options": ["…", "…"], "recommend": 0,
  "choice": null, "answer": null, "by": null, "result": null, "link": null, "language": "zh-CN" }
```

- If `ref` is empty, send a new message. Otherwise, update that message to its current state. If it cannot be updated, just report.
- After sending, report with `POST /v1/cards/56/delivered { "version": 2, "ref": "om_xxx" }`. Without a report, the card is offered again after one minute. **On platforms with idempotency keys, use only the card ID when sending a new message, without the version.** Feishu includes the version only when it sends a replacement for a finished card it cannot update. Deduplication cannot be guaranteed on platforms without this support. Webhook templates may resend after a report is lost.
- If sending fails, use `POST /v1/cards/56/failed { "version": 2, "error": "…" }`. Initial delivery retries at increasing intervals and gives up after one hour. The card stays open and remains visible in `agent-autoloop status`. Time when the channel has not come to claim it does not count.
- Cards resolved before delivery no longer interrupt you. Information-only `fyi` notifications can still be delivered within 24 hours of creation.
- When you click, use `POST /v1/cards/56/answer { "choice": 1, "by": "ou_xxx", "ref": "om_xxx" }`. Only the first answer counts. `by` must be in this channel's `answerers`, and `ref` must match the delivered message. A normal notification has one “Handled” button; clicking closes it. You can also include `text` with a note about how it was handled. On closure, this is saved in the card's `answer`, visible on the card and in `/v1/state`. Information-only `fyi` notifications have no button.

A minimal channel takes only a dozen or so lines: claim a card, send its text and `link`, then report. `link` is provided only to channels with `"links": true`; it is `null` for others. It opens a plain form page with no scripts, showing the card's text and buttons. Anyone with the link can answer. It is valid for 7 days from card creation. After expiry, the card's content is no longer shown either. This suits text-only group bots and email. Channels with buttons and callbacks, such as Feishu, should use buttons instead. The platform verifies identity, which is safer. On a single computer, `link` is a local address that phones cannot open. To answer from your phone, put the hub on a machine with a public URL and configure `publicUrl`.

## Owner: see everything, answer, resolve, stop

```
GET  /v1/state              Authorization: Bearer <本人的密钥>
→ 200 { "totals", "cards", "recentCards", "agents", "channels", "sources", "lines", "elsewhere", "runs", "nextBefore", "hasMore", "unrouted", "spending", "now", "timezone", "language" }

POST /v1/cards/56/answer    { "choice": 1 } or { "text": "Another idea" }
POST /v1/cards/56/resolve   { "reason": "No decision needed, because …" }
POST /v1/runs/12/cancel     {}
```

`agent-autoloop status`, `answer`, `resolve`, and `stop` are these requests.

### Pause, resume, run now

```
POST /v1/rules/Inspection/pause      { "reason": "Upstream is being fixed", "until": "2026-11-07T09:00:00+08:00" }   Both fields are optional
→ 200 { "changed": true, "rule": "Inspection", "paused": { "by": "owner", "reason": "Upstream is being fixed", "since": "…", "until": "…" } }
POST /v1/rules/Inspection/resume     {}
→ 200 { "changed": true, "rule": "Inspection" }
POST /v1/rules/Inspection/run        { "subject": "#12", "reason": "Take a look" }                         Both fields are optional
→ 200 { "event": 88, "run": 41 }
```

Only owner keys are accepted. Put the URL-encoded rule name in the path. The body can be empty; unknown fields return 400. A missing rule returns 404 `没有这条规则：<名字>` (“No such rule: <name>”). An `elsewhere` task returns 400 because the hub does not start it.

Pauses and resumptions are facts in the log, with kinds `pauseRule` and `resumeRule`. They do not change `rules.json` and survive restarts and projection rebuilds from the log. `by` is the name of the owner key used. Pausing again updates only the reason and `until`; `since` keeps the original time. If neither the reason nor `until` changes, `changed` is false and no fact is appended. `until` must include a time zone and be in the future. At that time, the hub resumes automatically and records a `tick` fact.

A rule can still be resumed if it was removed from `rules.json` while paused.

While paused:

- **Scheduled rules**: skip scheduled times without recording events or building a backlog. `lines[].skippedAt` is the most recently skipped time. After resumption, whether manual or at `until`, missed times during the pause are not caught up. Normal runs start at the next scheduled time from the moment of resumption. This also applies if the hub was asleep during the pause.
- **Event rules**: events are recorded as usual, but this rule does not take them or dispatch work, even after resumption. An event's `paused` records rules that skipped it because of a pause. `/v1/events` responses include a `paused` list, and `routed` lists only rules that actually took the event. The latest 20 such events appear in `/v1/state`'s `skipped`. These do not count as events with no matching rule. Other rules matching the same event take it as usual. There is no catch-up because a pause often means a broken downstream system or a need to limit damage. A flood of delayed work can be harder to handle than missed work. Use run now to make up a round when needed.
- **Rounds already queued, waiting to retry, or receiving an answer or due follow-up check during the pause**: stay queued without dispatch. They can be claimed as usual after resumption, and answers are kept. A running round is unaffected; use `stop` to stop it.

Run now uses normal dispatch. It records a `run.manual` event. Its source is `schedule` for scheduled rules or `when.source` for event rules. `summary` is “<key name> ran manually”, and `detail` is `reason`. `subject` determines the item for a `parallel` rule. If the same item already has a queued round, the event merges into it and cancels its retry wait. This round's `runs[].manual` is true. **A paused rule cannot run now.** It returns 409 `规则「…」暂停中，先恢复再手动运行` (“Rule ‘…’ is paused; resume it before running manually”). A pause means this rule dispatches no work, including manual runs. There is no exception to “paused means no more spending or external actions.” To try a run, resume first.

Each rule in `/v1/state` (`lines[]`) also has `paused`, containing the active pause's `by`, `reason`, `since`, and `until`, or `null` if not paused, and `skippedAt`. The top level also has `pauses`, listing all active pauses with a rule `name` on each, and `skipped`. Older clients can ignore these fields.

CLI commands: `agent-autoloop pause <规则> [--reason 原因] [--until 时间]`, `resume <规则>`, and `run <规则> [--subject 对象] [--reason 说明]`. `status` lists paused rules.

`agent-autoloop check [文件]` only reads the file and validates rules. It does not open the hub database or load the file into the hub. Without a filename, it checks `rules.json`. You can validate a draft before replacing the live file. `/v1/state` returns the latest 60 rounds at a time. Use `?before=<nextBefore>` for earlier ones.

`/v1/state`'s `spending.today` and `spending.week` are independent of pagination. They sum by completion time for today in the rules' time zone and the past 7 × 24 hours. Each contains `rounds`, `tokens`, `cost`, `missingTokens`, and `missingCost`. The last two count rounds that did not report the corresponding usage. Rounds cancelled before they ever started are excluded.

Installation and uninstallation do not change the HTTP protocol. `agent-autoloop --version` shows the version and commit. After confirmation, `agent-autoloop uninstall` removes its program, links, and services, and always keeps rules, keys, and records. `--yes` only skips confirmation.

## What happens on failure

| What happened | What happens next |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A source sends the same event twice | It is recorded only once |
| A claim response is lost | The same `claim` returns the same job |
| A result response is lost | Replay returns the same acknowledgment |
| An agent fails | Retry after 5 minutes, doubling each time up to 1 hour. Events for the same item received during the wait merge into this round. Tell you on the 3rd consecutive failure. Stop retrying on the 10th consecutive failure, mark the round `cancelled`, and send a notification card. Events received while it is running form a separate round. When this round ends or is stopped, close cards that said it would retry |
| You need to restore a browser connection, sign in, or verify your identity | End this round, keep completed business work and unverified items, and wait for an answer through a question card, with no automatic retry |
| The original session cannot be continued | Start a new session and continue from the context file |
| The original session resumes, then breaks halfway through | Count it as failed and retry in the original session on the schedule above. Do not repeat the business work in a new session |
| A receipt is invalid | Rewrite only the receipt, without repeating business work. For an agent without a session, discard the receipt and send a card |
| An agent plugin cannot read its own output | Let a running process continue. Once it ends or disappears, count it as failed and retry in the original session |
| A worker or channel stops, or a plugin has an uncaught error | Log it. Restart stopped components after 30 seconds. The hub and other components continue as usual |
| Another process holds the database too long | Skip this deadline attempt and retry after 5 seconds; the hub does not exit. Invalid rule changes during this time are still reported |
| Logs cannot be written, because the output pipe broke or the disk is full | Exit the process and let the system service restart it |
| A worker restarts | Running agents are unaffected; the worker resumes monitoring them |
| A worker is online but has not reported one of its rounds for 5 minutes | Mark it uncertain, release the group, and tell you. Still accept its result if it arrives later |
| A whole worker disappears | Keep its work reserved and tell you once after 10 minutes. After you close the card, do not remind you about that work again until new work arrives. Close the card automatically when it returns, and tell you again if it disappears next time |
| The hub restarts | Everything is in SQLite; everyone reconnects automatically |
| A scheduled time is missed | Catch up only the latest one on wake |
| You click twice, or click on both sides at once | Only the first counts |
| The problem fixes itself after a question | A later agent verifies it and closes it with `resolve`; the card changes to “No decision needed” |
| The rules are invalid | Keep running the previous rules and tell you what is wrong |
| A rule is deleted or renamed | Mark unclaimed rounds, and rounds that fail afterward, as `cancelled`. Stop dispatching them and send a notification card. Running rounds finish and their results are accepted as usual |
| A rule is paused | Skip scheduled times and do not take events, with no backlog. Keep queued work. After resumption, do not catch up; run normally from the next scheduled time |
| A pause has `until`, but the hub is off when it arrives | Resume on wake without catching up on times during the pause |
| The rules file is deleted, moved, or unreadable | Keep running the previous rules and tell you once. Use the file again when it returns. A new hub that has never loaded rules does not start if it cannot read them |

This is an at-least-once system. An agent may be called twice, so Skills must check the current state before actions with side effects.

## Who can do what

| Credential | Can | Cannot |
| ---------------- | ----------------------------------------------------------- | -------------------------------------- |
| Source key | Send events and messages in its own name | Impersonate another source or claim work |
| Worker key | Claim work assigned to it; send messages and questions for `elsewhere` tasks assigned to it | Touch others' work or send events |
| Round token | Report this attempt of this round | Touch other rounds |
| Channel key | Claim cards, report, and relay answers from `answerers` | Anything else |
| Card link with permission | Answer this card | Anything else |
| Owner key | See everything, answer, resolve, stop, and pause, resume, or run rules now | Send events, claim work, or change rules, which exist only in the file |

Ordinary access keys are stored only as SHA-256 hashes. The local master key is stored separately in `master.key`. The worker does not put hub keys into the agent's prompt or context file. The agent's permissions determine its filesystem access.

## Log and determinism

Each accepted input produces a batch of facts. Inputs that change nothing, such as duplicate events or heartbeats less than a minute apart, produce none. `commit` makes the decision, appends the log, and has `evolve` update the view in one SQLite WAL + FULL transaction. It responds only after commit. Rule versions, key hashes, claims, receipts, and answers are all in the log. Round tokens, card-link tokens, and the hub master key are never logged. The shell stores the master key in a local file. Round tokens and card links are derived separately with HMAC. Repeated claims reissue the token and immediately invalidate the previous one.

`decide(view, input, now, environment)` does not modify the supplied view or input. `evolve(view, facts)` is the only writer of persistent projections. The shell provides the clock, rules file, random material, network, and single timer. Facts contain a version, sequence number, time, kind, and normalized record changes. Replay does not rerun rules. Views read through SQLite indexes as needed. One decision keeps only its own changes, without copying whole tables or keeping all history resident in JavaScript. The rules row is the largest and is needed for every queued round, so each view parses it only once. New facts mean a new view, so stale rules are never read. The log, projections, log cursor, ID high-water marks, and derived indexes commit together. Deleted records' IDs are never reused. Normal startup opens the projections directly. The shell computes a format fingerprint from the files that determine stored content (`kernel/evolve.ts` and `kernel/credentials.ts`) and the master key. Changes to other files do not count. Query views are rebuilt at every startup. If an older version has no cursor, or the fingerprint differs, it reads the log one record at a time and rebuilds projections and indexes in the same transaction. It must not overwrite new commits made during that time or load the whole log into memory at once. The first upgrade may need time to rebuild. Old facts stay unchanged, and no data migration is needed. Simulation uses the same projection and decision implementation with an in-memory database.

The Node request conversion layer stays within 50 lines. The shell also provides files, SQLite connections, listeners, and timers.

`GET /v1/stream?after=42` accepts only owner keys and returns SSE: `id` is the log sequence number, `event: fact`, and `data` is the fact JSON. After a disconnect, use `Last-Event-ID` or `after` to continue from the next record. Read from 0 for the whole log. Records are sent one at a time at the subscriber's reading speed, without buffering the whole log first. Key hashes and capability credentials are not sent to subscribers.

`GET /v1/runs/42/why` accepts only owner keys and returns facts about this round's events, each attempt's rule version, claims, receipts, and card answers. The CLI's `agent-autoloop why 42` uses the same endpoint. It shows times in the local time zone as `MM-DD HH:mm:ss`. By default, it shows a timeline of events, rule versions, claimants, start and end times, sessions, receipts, answers, and continuation rounds, without printing the rules themselves. `agent-autoloop why 42 --json` prints raw facts. When internal answer and timer events encounter an existing ID, they add sequential suffixes to keep source and ID unique, without overwriting a source's events.

## Conformance and reproduction

Plugin entry points are always `plugins/<名字>/agent.ts`, `channel.ts`, or `source.ts`. The installation directory is searched before the engine's built-in directory. `agent-autoloop add <git 地址>` clones a plugin repository into `plugins/<仓库名>` in the installation directory. Entry files sit directly in the repository root. There are no automatic updates or installation scripts. The directory name is the plugin name: the repository name converted to lowercase, using only lowercase letters, digits, and `-`. Other names are rejected. Plugins are trusted code installed by you. Events cannot specify plugin paths.

Events accept optional `hops`, a nonnegative safe integer defaulting to 0. Receipt events must use the highest hops value among this round's events plus 1. Answers to questions and later timers retain the original depth. Events above 8 are still recorded but not dispatched, and produce a notification. Duplicate submissions do not repeat the notification. This limits processing chains inside the hub. New events sent directly by external sources can start at 0. Old log entries without hops are read as 0.

`DELETE /v1/keys/<source|worker|channel|owner>/<名字>` accepts only owner keys. Pass the name URL-encoded. It returns `{ok:true, changed}`. If the key did not exist, `changed` is false and no fact is appended. `agent-autoloop key remove <种类> <名字>` calls the running hub. Removal immediately wakes and rejects that key's long polls and closes its log subscriptions. Already claimed rounds continue submitting results with their independent round tokens.

`protocol/schema.json` uses JSON Schema 2020-12 and defines the formats for events, receipts, jobs, cards, and logs. `agent-autoloop conformance <测试地址> --config <文件>` uses real HTTP. The file contains `keys`, with four test keys for source, worker, channel, and owner; an `eventType` matching the test rule; and an `answerer` the channel allows. The rule must route that source and type to that worker, `parallel` must be at least 2, and the channel must restrict who can answer. The checks write events and cards, so run them only against a dedicated test hub. The same test hub can be checked repeatedly. Each source's signature format is checked by its plugin's tests.

Text limits count Unicode code points. A card answer's `text` allows at most 4000 characters, `by` at most 500, and `ref` at most 500. The message ID reported by a channel allows at most 500. `usage` must be an object of nonnegative finite numeric values, not an array. `later.at` must be an ISO date-time for a real date, with `Z` or a time-zone offset. The entire receipt is validated before execution.

`npm test` includes a 200000-step simulation with seed 24301 and all 8! action orderings for two workers, two source events, and one question card. The simulation switches to an independent scenario every 128 steps. Before each scenario ends, faults stop and the work is drained. Every state transition checks invariants and full log replay. Timer events are triggered by the real deadline table, and recovery checks that no due tasks remain. This proves these finite scenarios, not exhaustive coverage of arbitrary state spaces. Reproduce separately with `node sim/random.ts 24301 200000` and `node sim/enumerate.ts`.

`npm run test:nightly` runs 1000 real-process SIGKILLs, all kernel mutations in `sim/mutate.ts`, and performance measurements. Crash tests use real SQLite WAL + FULL and check acknowledged sequence numbers, integrity, views, replay, and duplicate submissions. They test process termination, not whole-machine power loss. Any missed mutation is a failure, with its name printed directly. Syntax errors cannot count as detected mutations. CI runs process kills and mutations once a day. Performance numbers depend on the machine, so measurements run only locally. Reproduce separately with `node sim/crash.ts 1000 12648430` and `node sim/mutate.ts`.

Simulation correctness checks must pass. Simulation speed is only an observation of development efficiency. Performance measurements use individual HTTP writes and respond only after each transaction is durable. Idle RSS and RSS under a thousand connections are measured separately; see README for measured values. Large histories, with results in [History growth measurements](#history-growth-measurements), are checked with `node scripts/history.ts 1000 10000 100000` for real business behavior, HTTP responses, slow log subscribers, kill-and-retry, and full rebuilds. Each scenario contains two task rounds, a question, delivery, an answer, and a scheduled follow-up check, with individual WAL + FULL commits. Requests use real HTTP. Each operation type and status summary is measured 30 times and reported as a median. Continuous-write, idle, and request-load memory are reported separately, without manually triggering GC.

Deep-queue overhead is measured separately with `BENCH_QUEUE=5000 node scripts/benchmark.ts --busy`. The rules are about 4.4 KB, 1000 long polls wait, and 5000 rounds are queued, adjustable through `BENCH_QUEUE`. It reports p50 and p99 for held-back heartbeats, CPU per heartbeat, facts written during the measurement, and medians for receiving events, claiming work, submitting results, and finding no work. `npm run benchmark` includes this too.

### ACP and MCP

`use: "acp"` with `command: ["Some ACP program", "Launch arguments"]` uses stdio ACP v1. ACP agents must specify `command`. Without it, the round counts as failed, with the missing setting stated in the reason. The bridge initializes first, then creates or resumes a session. If the agent declares `loadSession`, it uses `session/load`. If it declares only `sessionCapabilities.resume`, it uses `session/resume`. History replayed during loading does not count as this round's reply. Reasoning and tool output do not go into the receipt. The round starts when the prompt is sent. A later disconnect retries in the original session. When resuming, the previous attempt may already have done part of the work. A new session starts only if the agent explicitly rejects the session by returning an error or supporting neither recovery method. Failure to start the program, initialization errors, and disconnects during loading all retry in the original session. A session open in another program, where the error's `data.reason` is `thread_active_writer`, is not a rejection either. The round counts as failed, using the agent's own explanation, and is retried in the original session later. The card on the 3rd consecutive failure includes that explanation so you know what to close. All other errors count as rejection regardless of error code: the official Codex adapter returns -32603 for a genuinely missing session. Only `end_turn` with a final text message counts as completion. If `messageId` exists, it separates messages. Otherwise, reasoning, tool calls, and completed or failed tool updates all mark boundaries. When a round is incomplete, the bridge reports the reason immediately. If the agent has not exited after 30 seconds, it is stopped together with its process group. Messages are framed only by newlines; an unreadable line counts as a failed round. The hub stores the session ID. The bridge does not declare file read/write, terminal, or interactive login capabilities; the agent uses its own tools. If login is needed, sign in with its own CLI first.

Permissions select only one-time options. `read` allows structured reads and searches. `edit` also allows edits within the working directory, checking symlinks; a path through a link whose target cannot be found counts as outside the directory. `full` allows other operations. If a permission request includes only the tool call ID, use the kind and path previously reported for that call. Fields in the request itself take priority. Cancel if no matching option is offered. Permissions rely on the agent following ACP and provide no additional system isolation. The specification allows agents to act without asking, which `access` cannot block. Use the agent's own modes to restrict those operations. The official Codex adapter's only rejection option (`reject_once`) is `cancel`. Selecting it ends the whole round with `stopReason: cancelled`, which counts as failure and is retried by the hub. Command requests under `read` and `edit` return this way. If the agent must run commands, give it `full` or use its own mode. `model` and `effort` have no effect. References: [initialization](https://agentclientprotocol.com/protocol/v1/initialization), [sessions](https://agentclientprotocol.com/protocol/v1/session-setup), and [tool permissions](https://agentclientprotocol.com/protocol/v1/tool-calls).

`agent-autoloop mcp` provides stdio MCP, fixed to version [2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle). It does not support the handshake-free 2026-07-28 protocol. Tools are `status`, `why`, `answer`, `resolve`, `stop`, `emit`, and `tell`, shown according to the owner or source keys already present locally. It calls the same HTTP API and does not change the database directly. Keys stay in local `config.json`. Set the MCP client's program to `node`, its arguments to the engine's absolute path to `bin/agent-autoloop.ts` followed by `mcp`, and specify `AGENT_AUTOLOOP_HOME` in its environment. Standard output contains only JSON-RPC. Messages are framed only by newlines. Each tool call gets its own response, so a slow call does not block `ping`. It does not distinguish callers: all are recorded as you, with `answer` attributed to the owner and `emit` carrying no hop count. Do not put it in the user-level configuration of a CLI launched by the worker, or a round could answer its own cards.

### Channel templates and CLI examples

Webhook channels use `use: "webhook"`, `url`, and `platform` in `config.json`. The latter can be `dingtalk`, `wecom`, `slack`, or `discord`. Without platform, `body` can define a custom template, with `{text}` in strings replaced by the card content. The four templates follow the official documentation: [DingTalk](https://open.dingtalk.com/document/orgapp/custom-bot-send-message-type), [WeCom](https://developer.work.weixin.qq.com/document/path/91770), [Slack](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/), and [Discord](https://discord.com/developers/docs/resources/webhook#execute-webhook). WeCom shows the creating rule's name after the title. It labels ordinary URLs “Open link” and closure URLs for notifications without options “Click to handle”, without a separate “1. Handled” entry. Link markup and angle brackets written in cards are converted to full-width characters and displayed literally, rather than rendered as links, tags, or mentions. DingTalk and WeCom check the response's `errcode`; Slack checks `ok`. Discord prevents text from triggering mentions. Cards over WeCom's 2048-byte or Discord's 2000-character limit report failure, without truncating the question or answer link. Webhooks themselves have no idempotency guarantee. A message may be resent if sending succeeds but its report is lost.

The `telegram` channel uses the Telegram Bot API. `sendMessage` sends plain text, with no `parse_mode` so text written by others cannot become formatting, and one button row per option. A button's `callback_data` is `卡片:选项`. Card updates use `editMessageText` on the original message, with buttons removed from finished cards. Telegram reporting unchanged content counts as delivery. `ref` is `chat:消息编号`, and `by` is the clicking user's ID. Clicks are received through `getUpdates` long polling, requesting only `callback_query`. Including the processed ID in the next request acknowledges it. Every click gets `answerCallbackQuery` telling the person whether it was recorded. Cards over 4096 characters report failure without truncation. Telegram does not support idempotency keys, so a message may be resent if sending succeeds but its report is lost. Reference: [Bot API](https://core.telegram.org/bots/api).

The `desktop` channel is enabled by default for new installations. It uses `osascript` on macOS and `notify-send` on Linux. The notification title is “An agent has a question for you”. Its body is the card title and “Run agent-autoloop status to view”. Text is passed as arguments after `--`, never interpolated into the script. Without a graphical session, it does not call the notification program. It reports `skipped-<卡片编号>` and does not keep interrupting you. Cards can still be viewed and answered through the CLI. If a graphical session exists but the notification command is missing or fails, it reports `failed` and the hub schedules a retry. Card updates are only reported, without another pop-up.

`examples/worker.sh` and `examples/channel.sh` use only shell built-ins, curl, and jq. Set `AGENT_AUTOLOOP_URL` and `AGENT_AUTOLOOP_KEY` before running them. `AGENT_AUTOLOOP_ONCE=1` claims only once. The worker example submits the JSON in `AGENT_AUTOLOOP_RECEIPT`, defaulting to completion. The channel example prints the card to the terminal, then reports delivery. These demonstrate short tasks and are unsuitable for long ones. For long tasks, use the heartbeats, stopping, and recovery in `worker/`. `tests/examples.test.ts` actually runs both scripts against a temporary hub that passes protocol conformance checks, covering questions, delivery, answers, continuation, and invalid keys.

## Recipes

`examples/recipes/` provides seven recipes. Feedback handling, website monitoring, and Feishu weekly and business briefs default to the owner's private Feishu chat and `Asia/Shanghai`. All combine rules, channels, and `command`.

The feedback source only wakes the same item. Current business state and authorization are read again from trusted APIs. Website checks use this rule's open incident notification cards as the incident record. The first failure sends a notification and an investigation event. Ongoing failures stay quiet. Recovery closes the card and emits a recovery event. If you manually close a card before recovery, a continuing failure is reported again. Feishu collection writes a private snapshot and emits an event after reading everything. The summary checks the snapshot ID; an old event does not use new data. Collection and summarization run serially in the same group. Only data readable with your identity enters the summary. Invisible data is not treated as unsubmitted.

The browser handoff template has the main task invoke an installed entry point with arguments; it includes no browser driver. Trusted configuration fixes the command, target, and allowed actions. Continuation uses the Codex session ID actually returned by the entry point. Page content and external events cannot change those boundaries. If connection, login, or verification is blocked, the main task uses `ask` and ends this round. After the answer, it continues only the remaining browser steps. The browser helper does not delegate again or close the item independently.

Monitoring and Feishu summary scripts are verified with local mock HTTP and a fake Feishu CLI. They do not access real business data or send real messages. Public examples contain no internal addresses, accounts, or business records. Do not commit the data you substitute into the repository.

## Structure and measurements

An append-only fact log is the source of business state. Views can be rebuilt, and replay does not rerun rules. cron, later, retries, leases, and offline checks share a deadline table. The shell schedules only the next deadline's timer. It is recalculated only for an input that changed something or when a deadline wakes it. Inputs that change nothing, such as held-back heartbeats, neither read the queue nor write facts. Parts that change only with time each have their own deadline and are recalculated when the timer fires. The API is HTTP + JSON. The dedicated CLI, MCP, sources, workers, and channels all use the same endpoints.

| Directory | Responsibility |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `kernel/` | Deterministic decisions, evolution, log, deadlines, rule matching, request handling, and card forms |
| `host/` | Node HTTP, files and SQLite connections, clock, configuration, status summary, background services, and plugin loading |
| `protocol/` | Types, JSON Schema, input validation, HTTP client, and conformance checks |
| `worker/` | Claiming work, agent processes, heartbeats and stopping, receipt reading and submission |
| `cli/`, `bin/` | User commands, MCP, and CLI entry point |
| `plugins/` | Agent, event, channel, and delivery plugins with one discovery convention |
| `examples/recipes/` | Complete recipes with rules, task Skills, and setup instructions |
| `examples/plugins/`, `examples/skills/`, `examples/*.sh` | Minimal plugins, standalone task guides, and curl/jq examples |
| `skills/agent-autoloop/` | The hub's official configuration and operation manual for users and agents |
| `docs/` | Communication protocol, plugin development guide, and architecture diagrams |
| `tests/` | Everyday behavior tests and test helpers |
| `sim/` | Fixed-seed simulation, bounded enumeration, process kills, and mutation checks |
| `scripts/`, `.github/workflows/` | Performance and real-machine checks, installation smoke tests, and cross-platform CI |

See the [README](../README.en.md#ready-to-use-recipes) for ready-to-use recipes and built-in plugins, and [Writing plugins](plugins.en.md) for development templates. Plugin filenames still use the protocol's `source.ts`, corresponding to the user-facing term “event plugin”.

`npm run benchmark` prints cold start, idle and thousand-connection memory, individual durable writes, dispatch p99, held-back heartbeat p99 under a deep queue, and simulation throughput. There is no pass threshold. The numbers in README are local measurements on an Apple M5 Pro, not a statement of server capacity. Sampling times are not changed and GC is not triggered manually to lower readings. The log is append-only and uncompressed, so disk use still grows with history. Resident memory does not hold all history, but pending work and returned results still use memory. Aggregate statistics still traverse database indexes. There is no overview page, workflow canvas, agent memory, model routing, multi-tenancy, or plugin marketplace.

### History growth measurements

Apple M5 Pro, 24 GB, Node 24.21.0. Reproduce with `node scripts/history.ts 1000 10000 100000`:

| Completed task rounds (approx.) | Facts (approx.) | Normal startup | Idle RSS | Claim HTTP median | Status summary |
| -------------------- | -------------: | -------: | -------: | ---------------: | -------: |
| 2,000                |         11,000 |  84.7 ms |  59.1 MB |          0.89 ms |  11.2 ms |
| 20,000               |        110,000 |  83.2 ms |  58.9 MB |          0.84 ms |  83.6 ms |
| 200,000              |      1,100,000 |  99.8 ms |  59.1 MB |          0.82 ms | 927.1 ms |

- At 1.1 million facts, median request times for event ingestion, deduplication, result submission, heartbeats, idle channel polls, and `why` were 0.39–0.69 ms. Normal recovery after a process kill took about 101 ms.
- Memory: a peak of about 282 MB while continuously writing history; about 75 MB for business requests plus one slow log subscriber.
- What grows with history: status summary time, and disk space for the log and indexes.
- The first startup after a format change rebuilds everything from the log. At 1.1 million facts, it took 43.1 seconds with a peak of about 141 MB. Data matched before and after the rebuild. Ordinary restarts do not replay.
- 200000-step simulation (an observation): 93.8 seconds, 2131 steps/second.

## Delivery plugin

Delivery is an ordinary agent process in `plugins/delivery`. The kernel knows nothing about it. Projects still use `ops/delivery.json`, the labels remain `deliver`, `deliver-attended`, `deliver-review`, and `ask-owner`, and the commit status remains `delivery`. The review status defaults to `agent-review`, configurable with `review.status`. The command is configurable with `review.command`. See the [configuration manual](../skills/agent-autoloop/SKILL.en.md#delivery-pipeline) for the settings format, rules, and a Ship example.

The source provides only events. Hub rules fix the repository and execution commands. The built-in `poll.ts` reads pending labels and builds stable event IDs from the repository, item, label record, and current commit, without a separate cursor. If an item's label record cannot be read, that component is 0 without affecting other items. Delivery does not start for unlabeled items, including merged ones, items closed without merging, forks, or targets other than main. Each PR is one item. The rule's `parallel` and worker capacity control concurrency. Process failures use the hub's retries starting at 5 minutes and consecutive-failure notifications. There is no separate queue, slot management, failure count, or notification service.

| Step | Requirements |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read settings | Read project settings and review guidelines from the fixed main commit used for this round's review, never the PR's version. Read them again in a new round after main advances |
| Sync | The PR must include main. If it does not, ask GitHub to sync it and wait within this round for the synced commit before continuing. End the round for a hub retry only if it has not appeared within 15 minutes |
| Review | Convert bare Git objects into a text diff. Review only the branch's own commits, excluding clean merges from main while preserving conflict resolutions. Ordinary internal documentation can skip the model. If the branch contains an octopus merge with three or more parents, the review cannot see its changes, so report a problem and require a normal merge |
| Review process | Never check out the PR or run its code, tests, settings, or hooks. By default, Codex ignores user configuration and memory and reads only an isolated snapshot |
| Full checks | Convert drafts to ready first. Before conversion, record the latest check and accept only newer ones; workflow trigger types must include `ready_for_review`. Accept only the latest pull_request workflow for the current commit, with the workflow and specified jobs all completed successfully. Drafts and skipped jobs do not count. Every matrix job, with names such as `check (ubuntu-latest)`, must succeed |
| Merge | Re-read the PR head, target branch, main, and labels. If head changes or the target is no longer main, end the round for a hub retry. If main advances, return to sync within this round, at most 3 cycles. Write the configurable review status only after checks pass, and merge the reviewed SHA |
| Auto-merge and lost responses | Disable existing auto-merge first and read back to confirm. If the merge response is lost, check whether it merged before submitting again. If clearing labels fails, read back to confirm removal too. Remove `deliver` last for merged PRs and `deliver-review` last for unmerged PRs. If only some labels were removed, retries can finish without merging a review-only PR |
| Release | Wait for a successful Ship that covers the merge commit, then verify the healthy version. A health HTTP 200 cannot override a failed or unfinished Ship |
| Later releases | A newer version that covers the work and is actually live can complete an older delivery. A completed delivery does not regress because a later release fails |

`deliver-review` ends after a successful review and removes the delivery labels. It does not mean checks, merge, or release are complete. If added while waiting for checks, it still stops at review-only before merging and does not write the review status that permits merge. When review finds problems, both `delivery` and the review status are set to failure, and the problems are returned. Notification cards are separate per commit, so an open card for an older commit does not swallow problems in a new one. `deliver-attended` creates no extra notification card. A commit with a failed review status is not reviewed again or given a new status when another event arrives while labels remain. The round ends immediately; push a new commit for another review. This uses the review status because a failed round writes its error to `delivery`. If `deliver` is removed while waiting for checks, the round ends, `delivery` is set to success, and its description says it was withdrawn without merge or release. For ordinary issues, `ask-owner` only turns readable body text into a question card, stripping code blocks and local paths, and removes the label after an answer. It does not post GitHub comments, build a multi-round review ledger in the PR description, or allow “Handled” text to waive findings. New commits get a fresh review.

A merged PR with `deliver` continues directly to tracking Ship and health checks. Once the label is removed, it is no longer tracked and no status is written. A PR merged by someone else during review is still tracked. If tracking fails, the round writes “没跑成” (`FAILED`) and the hub retries as usual. Tracking defaults to at most 30 minutes, then hands off to a hub retry. Projects without health settings explicitly report that only merging is complete. Release scope compares **the entire diff from the healthy version to the target commit**. Only ordinary internal documentation changes can skip release. Executable bits, symlinks, renames to external paths, and unknown history all require release. Later documentation-only changes cannot skip an unfinished code release. If the health endpoint reports a short commit ID, resolve it to a full ID through GitHub first. If it cannot be resolved, release is required.

Ship uses `plugins/delivery/action.yml` from this engine repository, pinned by the project to a full released commit. The Action outputs only `release` and `superseded`. The project's existing release steps run based on those outputs. It shares scope and health decisions from `project.ts` with the delivery process, rather than keeping long-lived copies of tools in projects.

Ordinary health URLs must use HTTPS. Tests must explicitly pass `--test-local-health`, and the Action must likewise set `test-local-health: 'true'`, to accept `http://127.0.0.1`. No other HTTP addresses are accepted. Project maintainers configure GitHub merge rules.

## Versions and compatibility

Version numbers appear only in tags (`v1.2.3`), never in files. `agent-autoloop --version` reads the tag on the current commit and shows “Unreleased” if it is not a release commit.

| Largest impact of a change in this release | Version change |
| ------------------------------------ | ------------------------- |
| Bug fixes only | Increment the third number: 1.1.1 → 1.1.2 |
| New capability or changed default behavior, with existing usage still working | Increment the second number: 1.1.1 → 1.2.0 |
| Existing usage no longer works without changes | Increment the first number: 1.1.1 → 2.0.0 |

Existing usage means:

- `/v1` endpoint paths, field meanings, and authentication;
- Plugin conventions (`plugins/<名字>/{agent,channel,source}.ts`);
- `rules.json`;
- Documented commands and arguments;
- Delivery conventions (`ops/delivery.json`, the four labels, and the `delivery` status);
- Data left by an older version that the new version can keep using.

Internal code, undocumented fields, and prompt text do not count. Adding fields is not a breaking change, so plugins and clients must ignore unknown fields. Before removing something, mark it deprecated and release a version with the second number incremented. Remove it only in the next version with the first number incremented.

`/v1` is counted separately. It changes only when the HTTP API is incompatible; software version 2.0 does not mean protocol `/v2`. Published versions never change. If something is wrong, release the next number.

Release a completed batch of changes that day. Release fixes for crashes, data loss, security problems, or installation failures that day. Release the rest every Tuesday. Documentation-, test-, or CI-only changes do not get a release. Large changes can have a prerelease first (`v1.2.0-rc.1`); installation and `update` do not install it.
