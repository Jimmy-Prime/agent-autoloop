# Website watch and incident investigation
[简体中文](README.md) | [繁體中文](README.zh-TW.md) | **English**

An outside machine checks the website. A failure is handed to the maintenance agent. Recovery closes it out. A fixed script runs every 5 minutes. When things are normal, it does not call a model. While a failure continues, it does not dispatch again or send another notification. On recovery, it updates the original card.

## How to turn it on

1. Copy this directory to `~/.agent-autoloop/work/website-watch/`. Only the owner can read the directory. The computer that runs the check script has to be outside the service being checked, so a stopped server does not take the watch down with it.
2. Put `SKILL.md` in `~/.codex/skills/website-watch/`. For Claude Code, put it in `~/.claude/skills/website-watch/`.
3. Merge `sources`, `agents`, `channels`, and `rules` from `rules.json`. Change both `worker` values to the worker computer. The check rule's `cwd` points at the copied template directory. The investigation rule's `cwd` points at your own code directory. Use the time zone `Asia/Shanghai`.
4. Edit `site.json`. Fill in your own site id, name, health URL, and the text the response must contain. The example domain is only a placeholder. It cannot be the target you accept against. The address has no username, password, query string, or fragment. A health endpoint that needs authentication should have the check script changed first, following your project's own convention.
5. Permissions: `read`. The maintenance agent only reads local code by default. HTTP requests are made by the fixed check script. To read production logs, or to run an action that was already approved, register an existing tool in the maintenance guide on the project's main. Do not take a command from the event.
6. Run `agent-autoloop check`. Then, on a dedicated test hub, attach a local fake HTTP service and check a failure, a failure that continues, and a recovery. Do not test by taking a real website down.

## How a check is judged

Success requires both HTTP 200 and the non-empty text named by `contains`. Redirects are not followed. A connection failure, a read timeout (20 seconds), or content that does not match counts as a failure. The response body is not printed. This example reports on the first failure. It does not reuse an internal monitor's “three times in a row” count, so the template does not keep a second copy of that state. If the website already has mature alert debouncing, connect that alert as an event directly.

An unrecovered failure stays on the hub's problem notification card. The script checks only the card for the current site. While that card is still open, it does not send again. On recovery it closes the card and emits a `site.recovered` event so the maintenance agent can check what is left. **Do not click “已处理” (Handled) early to close a card for a failure that has not recovered.** Closing it by hand means this reminder has been handled. If the next check still fails, it reports again. One check group is used only for this one site, and the name stays stable. Each extra site uses its own source, rule names, group, and site id. Each set's `emits.source` must match only that site's handling rule's `when.source`, so another site's alert is not sent to the wrong project.

HTTP recovery does not mean the browser, or every business function, passed. When the owner has to restore a page connection, a sign-in, or a permission, the maintenance agent uses `ask` to leave the remaining work. This round ends. Do not rerun the business work over and over.

## Feishu notifications

The rules register a `feishu` channel by default. Replace `ou_REPLACE_ME` with the owner's open_id. Under `channels.feishu` in the existing `config.json`, set this person's `user` and the channel key you already have. Reuse the Feishu channel that is already running. Do not open another listener. If it is not connected yet, finish that from [channel setup](../../../skills/agent-autoloop/SKILL.en.md#connect-a-channel). When the configuration involves a new key or new permissions, get the owner's approval first.

Business data is read as the owner. Notifications use the bot. By default it goes only to the owner. One hub hands a card to every channel it has configured. A rule that holds private data sets `channels`, and sends only to the channel of the owner's private chat. Do not mix in a shared group channel. Do not commit keys, a real open_id, a table token, or business data to the repository.
