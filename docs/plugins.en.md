# Writing plugins
[简体中文](plugins.md) | [繁體中文](plugins.zh-TW.md) | **English**

First check the [built-in plugin list in the README](../README.en.md#plugin-ecosystem-swap-any-of-the-four-sides) for an existing implementation. To extend it, start with one of these three runnable minimal templates and replace the business logic:

| Template | What it already demonstrates | What you replace |
|---|---|---|
| [Agent template](../examples/plugins/hello-agent/agent.ts) | Simulate execution with `printf`; read output, the session ID, and whether the prompt was accepted | The new agent's launch command and output parsing |
| [Channel template](../examples/plugins/hello-channel/channel.ts) | Claim cards, write them to a file, and report delivery; answer through the CLI | Sending, updating, and answer callbacks for the target platform |
| [Event plugin template](../examples/plugins/hello-source/source.ts) | Verify an HMAC-SHA256 signature and turn a mock order into an event | Signature verification and field mapping for your business system |

Event plugins, workers, channels, and the CLI share the same HTTP + JSON API. To use the protocol with Shell alone, see the [worker script](../examples/worker.sh) and [channel script](../examples/channel.sh). Set the hub URL and key, then run them; they need `curl` and `jq`. They demonstrate short tasks. For long tasks, use the built-in worker's heartbeat, stop, and recovery support.

A plugin is a directory with an `agent.ts`, `channel.ts`, or `source.ts` entry point. Use only `node:` modules and files in your own directory, and declare types inside the plugin. Do not use relative imports of engine source: plugins installed in `~/.agent-autoloop/plugins/` cannot reach the engine through relative paths. Built-in plugins ship with the engine, so they can directly import small helpers such as `findProgram` and `tail` from `worker/agents.ts`. The engine does not import plugins in return.

Use `agent-autoloop add <git 地址>` to install into `~/.agent-autoloop/plugins/<仓库名>`; local Git repositories also work. The plugin name is the directory name: the repository name converted to lowercase, using only lowercase letters, digits, and `-`. Other names are rejected, with the derived name shown in the error. Use this name in a rule's `use` and a source's `adapter`. Installation only clones the repository. It does not install dependencies, run installation scripts, or update automatically. Loading executes the plugin. A plugin in the installation directory takes priority over a built-in plugin with the same name.

## Run it first

Run this command in the engine directory. It installs each of the three examples into a temporary hub, runs signature verification, dispatch, execution, notification, and reporting, then cleans up on exit.

```bash
node --disable-warning=ExperimentalWarning --test --test-name-pattern='agent-autoloop add' tests/example-plugins.test.ts
```

## Agent plugins

Start with [hello-agent/agent.ts](../examples/plugins/hello-agent/agent.ts). It uses `printf` instead of a model and still runs when cloned elsewhere. It prints one line when it accepts the prompt and another when it finishes. From the first line, `read` knows this round has resumed the original session. The second line is its final message.

| Method on the exported object | Purpose |
|---|---|
| `command(turn)` | Return an array of command arguments; arguments are not executed as shell code |
| `read(stdout, code, stderr)` | Return `text`, `session`, `usage`, `sessionUsage`, `error`, `finished`, and `started`; `code` is `null` while running |
| `link(session)` | Optional link to open this session. When a receipt is invalid, any plugin whose `read` returned a `session` rewrites only the receipt, whether or not it has a link |
| `check()` | Optional. Return `null` if ready to use; otherwise return what to do next |

`turn` contains `prompt`, `session`, `resume`, `cwd`, `access`, `model`, `effort`, `command`, `contextFile`, and `folder`. `contextFile` is the context file. Restricted CLIs need permission to read `folder`. `read` must handle incomplete output and return `text` only when the CLI has actually finished. If `read` throws or returns nothing, a running process keeps running. Once it ends, the round counts as failed and is dispatched again in the original session.

Plugins that support `resume` must return `started: true` from the moment the agent accepts the prompt, including while running and after an error. Otherwise, a failure halfway through is treated as an unavailable session, and the business work is repeated in a new session. If you return a `session`, you must use `turn.resume` to resume it. Both retries after failure and rewrites of invalid receipts rely on this. A CLI that cannot resume must not return a `session`.

`usage` is the amount used by this launch. Some CLIs report only cumulative session totals so far, such as Codex tokens and Claude Code cost. Put those fields in `sessionUsage`, and also return `session`. Before launch, the worker records the previous totals for that session. After it ends, the worker subtracts them and reports the difference together with `usage`. These records live in `~/.agent-autoloop/worker/usage/`, so restarting the worker midway does not double-count usage.

If there is no record for a resumed session, such as after moving to another computer or for a session from before an upgrade, or if a cumulative value decreases, those fields are omitted for this launch rather than guessed. Normal reporting resumes on the next launch. Usage by another program in the same session cannot be separated. For example, if you open the link and keep chatting, that usage counts toward the next resumption. If a CLI changes to reporting per-launch values, move those fields back to `usage`. Do not guess from the size of the numbers.

Select this plugin in the rules:

```json
{ "name": "Hello", "worker": "my-computer", "use": "hello-agent", "access": "read" }
```

Codex's Windows elevated sandbox uses a dedicated account. The plugin grants that account's group read access only to this round's `context.json`. It does not open access to the hub directory or change the account or sandbox mode.

Native Windows execution supports `.exe`/`.com`, PowerShell `.ps1`, and JavaScript `.cmd` wrappers generated by npm. For npm wrappers, it runs the JS entry point directly, preserving Chinese text, multiple lines, and quotes. Other `.bat`/`.cmd` files are not launched as shell source code. Use an executable or `node script.js` instead. Unix still uses a login shell to find commands; Windows uses PATH. The agent itself must also support the current operating system. Run the shell and curl/jq tutorials in this guide on Unix or WSL.

If you only need to print a final message, use the built-in `command` with an argument array. No plugin is needed. Arguments can contain `{prompt}`, `{model}`, `{effort}`, `{cwd}`, and `{context}`. Each argument gets one substitution pass. The inserted prompt is passed to the program unchanged: `{cwd}` or `$&` inside the prompt stays exactly that and is not substituted again. The runtime also provides `AGENT_AUTOLOOP_CONTEXT` (the context file) and `AGENT_AUTOLOOP_RUN` (the round number) as environment variables.

DeepSeek Harness has a built-in `dsh` plugin. Set `use: "dsh"` in the rules. It needs 0.2.2 or newer; `agent-autoloop doctor` checks this. npm's `latest` is still an old version, so install it with `npm install -g @deepseek-ai/dsh@next --allow-scripts=koffi,node-pty,@deepseek-ai/dsh-subprocess-local`. Newer npm versions do not run dependency installation scripts by default. Without allowing these three packages, installation looks fine but running it fails. After an upgrade from an older version, 0.2.2 may fail to read `refs` in `~/.dsh/.credentials.yaml` and report `MISSING_CREDENTIAL`. Put the key in an environment variable; for Linux system services, put it in `~/.config/environment.d/*.conf`. It reports tokens, not cost. A user has tested Q&A, usage, and `resume` on WSL2 with 0.2.2-rc.1 and a third-party OpenAI-compatible service. It runs a round with `dsh headless --json`, gets the session ID from the `session` event, resumes with `--session-id`, sums `step_end` usage as tokens, and counts the round as finished only on a `final` event. Each time, `access` maps to `--permission-mode`, and calls needing human approval are rejected with `--approval-policy never`. The rule's `model` and `effort` have no effect; use DSH's own configuration. There is no link to open a desktop session. DSH uploads session logs to DeepSeek by default; see [its documentation](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md).

### Browser access

Browser tools are installed on the computer running the agent and provided through that CLI's tool configuration or a project Skill. The Codex plugin launches background [`codex exec`](https://developers.openai.com/codex/noninteractive/), which can use its configured [MCP tools](https://developers.openai.com/codex/mcp/). Being able to open a page in the desktop app does not establish that the background process can access the same browser.

For complete rules, a Skill, and a script that invokes Codex with arguments on Claude's behalf, see the [browser handoff template](../examples/recipes/browser-handoff/README.en.md). You configure the entry command, target, and allowed actions. The browser helper returns evidence and a session ID; the main task handles business work and the receipt.

If you already have a dedicated browser entry point, state its actual command, how to resume its session, and its allowed actions in the rule's `prompt` or `skill`. Hand off only browser steps. Have it return what it saw, action results, and reasons it was blocked. The main task handles business work and the hub receipt. A browser entry point is optional. The hub does not bundle a script tied to one computer or automatically change the CLI's tool configuration.

For tasks that need browser verification, actually open the target page with the same background launch method, check its content, and resume a session once. If no usable entry point is available, or you need to restore a connection, sign in, or verify your identity, keep the unverified items and use the existing `ask` to wait for recovery. Do not write “没跑成” (`FAILED`) and trigger a retry. An HTTP query does not count as completed browser verification.

## Channel plugins

Start with [hello-channel/channel.ts](../examples/plugins/hello-channel/channel.ts). It writes cards to a file and lets you answer through the CLI.

The default export is an async function taking `{ hub, options, log, signal }`. `options` comes from `config.json` and does not contain the hub key.

| Call | Purpose |
|---|---|
| `hub.nextCard(50)` | Long-poll for a card; return `{ card: null }` if there is none |
| `hub.delivered(id, version, ref)` | Report delivery and save the external message ID |
| `hub.failed(id, version, error)` | Report a send failure |
| `hub.answer(id, { choice, by, ref })` | Forward an answer; check the person answering and the original message |

If `ref` is empty, send a new message. Otherwise, update the original message; if it cannot be updated, just report. Cards with no report are dispatched again after one minute. Exit when `signal` is aborted. If the function returns or throws before then, it is logged and restarted after 30 seconds, so it must keep running. The plugin and hub share a process. Uncaught errors are logged without making the hub exit.

Register the channel in `rules.json`, get a key with `agent-autoloop key new channel cards`, then add this entry under `channels` in `config.json` and restart the hub:

```json
{ "cards": { "use": "hello-channel", "key": "channel key", "file": "/tmp/cards.txt" } }
```

For channels that receive callbacks, set `answerers` in the rules. If it is unset, anyone in the channel can answer; `doctor` warns you. For channels that only send text, set `links: true` and send `card.link`. Anyone with the link can answer that card.

Channels share a Node process with the hub, so await external calls asynchronously. The built-in Feishu channel makes async CLI calls for user lookups, sending, and updates. The hub can still receive events and heartbeats while it sends.

## Event plugins

Start with [hello-source/source.ts](../examples/plugins/hello-source/source.ts). It checks the HMAC-SHA256 in `x-shop-signature`, then turns the order into an event.

The default export is a synchronous function taking `{ headers, body, secret }`. Verify the signature before parsing the raw body. Return an array of events, `[]` when there is nothing to do, or throw to reject the request. Event plugins only translate; they make no requests.

Register the source in `rules.json`:

```json
{ "shop": { "name": "Shop", "adapter": "hello-source" } }
```

The request path is `/v1/in/shop`. Put the secret in `AGENT_AUTOLOOP_SECRET_SHOP` in `secrets.env`, not in the rules. Convert the source name to uppercase and replace `-` with `_`; restart the hub after changing it. Events need a stable `id` and a valid `type`. They can include `subject`, `summary`, `detail`, and `link`; see the [protocol](protocol.en.md#sources-turn-the-world-into-events) for limits.

If the source can send standard JSON directly, no plugin is needed. Call `POST /v1/events` with a source key.

## What access actually allows

Plugins translate `access`; it is not a system sandbox provided by the hub. The following applies when local permissions have not been relaxed further.

| Plugin | `read` | `edit` | `full` |
|---|---|---|---|
| Codex | `read-only`: can run shell commands, cannot write files; commands have no network access by default | `workspace-write`: can run shell commands and write to the working directory and temporary directories; commands have no network access by default | `danger-full-access`: can write files, run shell commands, and access the network, with no approval |
| Claude Code | `plan`: can read files and run read-only commands; other commands depend on automatic approval and local rules | `acceptEdits`: also allows file edits and common file operations within the directory; arbitrary shell commands or network access still need approval | `bypassPermissions`: skips tool approval, with no additional system isolation |
| DeepSeek Harness | `read-only`: cannot write files; file reads and network access are unrestricted | `workspace-write`: commands and file changes are limited to the working directory and temporary directories; file reads and network access are unrestricted | `danger-full-access`: unrestricted |
| ACP | Approve reads and searches when the agent asks | Also approve edits within the working directory | Approve every operation it asks about |

All three Codex levels have been run with the plugin commands. The DeepSeek Harness and Claude Code descriptions come from the [DSH documentation](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md) and [official permission guide](https://code.claude.com/docs/en/permission-modes), respectively; they have not been tested with model calls. Codex command network restrictions have a different boundary from hosted search and MCP; see the [official sandbox guide](https://learn.chatgpt.com/docs/agent-approvals-security). Your CLI configuration may change these capabilities. `read` does not mean local keys are unreadable.

ACP's `access` covers only operations the agent asks about. The specification allows agents to act without asking, which `access` cannot block. Restrict those with the agent's own modes, for example `env INITIAL_AGENT_MODE=read-only …` in `command`. ACP's `model` and `effort` have no effect either; set them on the agent's side.

The recipes choose permissions accordingly. The morning brief uses `edit` to write local files. Issues use `edit` to change code and a fixed script to fetch issue bodies over the network. Alerts use `read` to inspect code and stack traces attached to events. Feedback handling and Feishu briefs use `edit`; website investigation uses `read`. Fixed monitoring and Feishu collection scripts handle network access, and the summary agent only reads complete snapshots. `command` and fixed scripts run as the local account and are not restricted by `access`.

## Conformance tests

Run the protocol's existing HTTP checks in the engine directory. They all use temporary data and random ports:

```bash
node --disable-warning=ExperimentalWarning --test tests/conformance.test.ts
```

To check another hub implementation, use `agent-autoloop conformance <测试地址> --config <测试凭据文件>`. See the [protocol](protocol.en.md#conformance-and-reproduction) for the file format. It writes events and cards, so run it only against a dedicated test hub.

For complete plugin integration tests, see [tests/example-plugins.test.ts](../tests/example-plugins.test.ts). You can also write standalone processes in other languages; see the [curl/jq channel](../examples/channel.sh) and [worker](../examples/worker.sh).
