# Installation guide (for an agent)
[简体中文](INSTALL.md) | [繁體中文](INSTALL.zh-TW.md) | **English**

The user asked you to install the Agent Autoloop hub. Install it first, then walk through a question and the continuation. Do whatever you can do yourself.

## Install

Native Windows, macOS, and Linux are supported. You need Node.js 24 or newer, Git, and a command-line agent that is already signed in. macOS/Linux also need curl. Windows uses the built-in PowerShell 5.1 and Task Scheduler.

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/Jimmy-Prime/agent-autoloop/taiwan/install.ps1 | iex
```

The default install directory is `$env:USERPROFILE\.agent-autoloop`. The command directory is added to both the current process's PATH and the user's PATH. The Windows service starts after the owner signs in and stops on sign-out. You can also use `service install` when managing it over SSH; the task runs in an existing signed-in Windows session. Codex 0.167's native sandbox has runner pipe-in timeouts in OpenSSH sessions, while local signed-in sessions work. See the [known Codex issue](https://github.com/openai/codex/issues/37722). For CI or command-line tests, use `--no-service`, then run the full command the installer prints to start `up`. Desktop notifications appear only in the same signed-in session.

To install from a local repository:

```powershell
$env:AGENT_AUTOLOOP_REPO = 'C:\code\agent-autoloop'
& 'C:\code\agent-autoloop\install.ps1' --agent codex --no-service
```

If the system does not allow local scripts, use `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\code\agent-autoloop\install.ps1 --agent codex --no-service` for this command only, without changing the global execution policy. Other install options are the same as for macOS/Linux below.

Install in WSL2 as Linux. The service needs systemd enabled in the distro; otherwise, add `--no-service`. WSL2 desktop notifications do not reach the Windows desktop.

Check `node --version` first. Homebrew's `node@24` is not on PATH by default. After installing it, also run `export PATH="$(brew --prefix node@24)/bin:$PATH"`. Write that into the user's shell config only when it needs to last. Do not sign in as the user, and do not read or copy login credentials.

This repository is public. The install script and the code can be downloaded anonymously. No GitHub account, sign-in, or GitHub CLI (`gh`) is required. The macOS/Linux command below installs the hub and enables a service that stays up after login:

```bash
curl -fsSL https://raw.githubusercontent.com/Jimmy-Prime/agent-autoloop/taiwan/install.sh | sh
```

GitHub issue polling, PR delivery, and similar features also need `gh` signed in. Configure those from the guide for that scenario. Running an agent still needs that agent's own login or authorization.

The installer and `agent-autoloop update` both install the latest Release. That is the version that has passed every check. Changes on `main` that are not released yet wait for the next Release. If an official upstream KKKKhazix/agent-autoloop install is already there, running the command above switches it to follow this fork's Releases. Rules, keys, and records are kept.

When the user names a local repository, use that directory's install script and set `AGENT_AUTOLOOP_REPO` to its absolute path. Do not download an old script from GitHub, and do not present uncommitted files as the installed version. In that case the installer clones the local repository's HEAD, and `update` follows that repository, not Releases. If it is already installed, this variable has no effect. It still follows the original source. To change the source, run `agent-autoloop uninstall`, then install again.

The example below uses `/path/to/agent-autoloop` and Codex, already signed in:

```bash
AGENT_AUTOLOOP_REPO=/path/to/agent-autoloop sh /path/to/agent-autoloop/install.sh --agent codex
```

`--agent claude` selects Claude Code. If the only tool is some other CLI, add `--command 'hermes chat -Q -q {prompt}'`. If you do not specify one, it detects agents installed on this machine and uses the first as the try-run target.

The program is installed in `~/.agent-autoloop/app`. Configuration and records stay in `~/.agent-autoloop`. Desktop notifications are on by default. When there is no graphical session they are skipped quietly, and questions can still be seen with `agent-autoloop status`. On macOS/Linux, the command goes in `~/.local/bin` when that directory is on PATH. Otherwise it picks the first writable directory on PATH. It does not use sudo and does not overwrite other programs. When there is nowhere to put it, use the full path the installer prints.

The installer and the hub both set the data directory to `0700` on macOS/Linux when they start. On Windows, they use an ACL that allows only the owner and SYSTEM. This includes a directory that already exists, so other system users cannot read the database, events, or run output. Codex's dedicated Windows sandbox account is additionally granted read access only to each round's `context.json` task data. The master key and round tokens remain inaccessible. After an upgrade, the hub and the worker restart together. The new `status` uses the cost summary the hub provides.

If the projection format changes during an upgrade, it rebuilds from the old log, one fact at a time. A long history means the first start has to wait. Later starts reuse the projection. The original log and existing card links are kept. No manual migration is needed.

## A temporary HOME, CI, or no service manager

When you use a temporary HOME, do not install a system service, and do not change the real user's shell config or agent config. Keep the `AGENT_AUTOLOOP_HOME` the caller set. Use the real `CODEX_HOME` only to reuse a Codex login that is already done.

In a temporary environment, pick a free port, run the local install script, then start the hub:

```bash
port=$(node -e 'const s=require("node:net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')
AGENT_AUTOLOOP_REPO=/path/to/agent-autoloop sh /path/to/agent-autoloop/install.sh --agent codex --no-service --port "$port"
agent-autoloop up
```

`up` keeps running. In the agent's command tool, keep the running session it returns, and use another command to finish the checks. Do not substitute `nohup … &`. The command tool may clean up background processes when it exits. Run the check commands after you see the listen address. If startup fails, deal with the error in that session first.

When the command is not on PATH, replace `agent-autoloop` with the full path the installer printed. Temporary tests use fake notification programs or channels. Do not show real notifications on Windows either. Do not open another listener on a Feishu app that is already online.

## Check

First look at the install and the connections, then run a full question and answer with the real agent:

```bash
agent-autoloop --version
agent-autoloop doctor
agent-autoloop try
```

`try` uses the user's model quota. In a non-interactive terminal it prints the question and the `agent-autoloop answer` command, then exits. That is a normal wait, not a failure. Hand the question to the user, answer with their choice, then run `agent-autoloop status`. It counts as connected only when you see “试跑通过” (in English, “the trial passed”). For an install check only, you can pick the second option, green, to finish the try run.

When Claude needs to hand web pages to Codex, you can use the [browser handoff template](examples/recipes/browser-handoff/README.en.md). Configure the existing entry point first, then check the first call and continuing in the original session. The template does not install a browser driver, and it does not automatically loosen Claude's command permissions.

When the task also needs browser actions, follow [Browser access](docs/plugins.en.md#browser-access) as well, and verify the real page and session resume with the same background launch method. `try` only proves the question-and-answer flow. The hub does not automatically provide a browser connection or change the agent's tool configuration. When the owner needs to restore a connection, sign in, or verify, keep the items still to be checked and hand them over with `ask`. Do not rerun business work that is already finished.

When no system service is installed, `doctor` shows that the service is not running. Check that the hub, the agent, and the desktop channel are online. Do not install a real service just to clear that notice.

## Write the first rule

After the install check, pick one from the [recipes in the README](README.en.md#ready-to-use-recipes) for what the user wants handled automatically, then write the rule from the [configuration manual](skills/agent-autoloop/SKILL.en.md). Ask only when the user has not named a use yet. Check with `agent-autoloop check`. Changes take effect within a few seconds.

For work in China, start with the three recipes for feedback, website watch, and the Feishu weekly report and business brief. They default to the owner's private Feishu chat. After you replace the placeholders, keep configuration and business data in a private directory. Do not commit them to a repository. The recipes do not create credentials for the user or widen Feishu permissions.

Desktop notifications show only on this computer. When another channel is needed, confirm where it should arrive, then connect it from the configuration manual. Do not test by sending a message or a group message directly. What `access` means is in the [plugin guide](docs/plugins.en.md#what-access-actually-allows). Do not widen permissions for the user.

## Uninstall

Uninstall the program. Rules, keys, and records are kept by default:

```bash
agent-autoloop uninstall
```

It runs only after confirmation in the terminal. For a non-interactive run, add `--yes` to skip confirmation. The data is still kept. It only stops its own service and processes, deletes the command and Skill link that point at itself, and deletes `app` inside the install directory. Other files with the same name are left alone. The data directory is not deleted.

After a temporary install check, use `agent-autoloop uninstall --yes` to stop this run's processes, then remove the temporary directory you created. Do not uninstall a hub the user is already using.

## Documentation

- [Configuration manual](skills/agent-autoloop/SKILL.en.md): connect event plugins, channels, more than one computer, and the delivery pipeline.
- [Protocol](docs/protocol.en.md): HTTP, receipts, the fact log, and recovering from failures.
- [Plugins](docs/plugins.en.md): three runnable minimal examples.
- [Security boundaries](SECURITY.en.md): keys, execution permissions, and delivery review.

Windows development checks use `npm run test:windows` and `node scripts/install-smoke-windows.ts`. Linux/macOS use `npm run test:quick` (use `npm test` when you changed `kernel/`, `protocol/`, or `sim/`), `npm run typecheck`, and `npm run format:check`. Full failure checks and the performance measurements use `npm run test:nightly`. Backup and restore are in the [configuration manual](skills/agent-autoloop/SKILL.en.md#logs-and-recovery). If `master.key` is damaged, the hub refuses to start. Restore it from a backup. If there is no backup, delete it. A restart generates a new one, and card links already sent, and rounds that are running, become invalid.
