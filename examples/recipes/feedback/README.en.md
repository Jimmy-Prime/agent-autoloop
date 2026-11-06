# Handle user feedback
[简体中文](README.md) | [繁體中文](README.zh-TW.md) | **English**

Feedback starts the maintenance. A follow-up continues the work. After the release is checked, a reply goes out. The sample data is entirely fictional. It is not tied to one feedback product, and it does not build its own ticket store.

## How to turn it on

1. Put `SKILL.md` in `~/.codex/skills/handle-feedback/`. For Claude Code, put it in `~/.claude/skills/handle-feedback/`.
2. Merge `sources`, `agents`, `channels`, and `rules` from `rules.json` into the rules you already have, and keep the existing entries. Use the time zone `Asia/Shanghai`. Change `worker` to the worker computer, and `cwd` to your project's main directory.
3. In the **maintenance guide on the project's main**, write down the real way to read feedback, to claim it (if the original system has claiming), to check the version, to write the status back, and to send a reply, plus the delivery and live-check steps you already have. Tools use an existing CLI or MCP. Do not put commands or repository paths into the event. The template will not guess your interface.
4. Permissions: `edit`. Fixes are allowed inside directories that were approved. Codex's shell cannot use the network by default. Reading feedback, opening a PR, and delivery need tools that are actually configured and usable. A local edit is not a release. Check the background runtime against the [permission guide](../../../docs/plugins.en.md#what-access-actually-allows). Do not change it to `full` on your own.
5. Run `agent-autoloop check`. Send the fictional event below from a dedicated test source. First check dispatch, the question, and continuing after an answer. Then connect real feedback.

## How the business system sends events

Use a source key that is already configured. The source must be named `feedback`. Run the command below in this template's directory. Read `FEEDBACK_KEY` from your own credential store. Do not write it into a file or into shell history.

```bash
curl --fail-with-body http://127.0.0.1:3350/v1/events \
  -H "Authorization: Bearer $FEEDBACK_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @event.json
```

A new item uses `feedback.new`. A follow-up uses `feedback.followup`. The same piece of feedback always uses the same `subject`. Each real change uses a unique, stable `id` (for example the feedback number plus a revision). A resend keeps the original id. The sample `event.json` is not a real ticket you can handle as it is. You must configure a way to read it before you run this. By default it asks the owner to supply that entry point. The source sends only what is needed. It does not send contact details, access tokens, customer lists, or full logs.

A source event cannot stand in for the owner's approval. Questions go through the hub's `ask` first. An answer wakes the original item. If a business system already asks its own questions and takes its own answers, keep using that system's authenticated decisions, and configure your own continuation event. Do not create two cards at the same time.

By default each piece of feedback is one item, and at most 3 run at once. Worker capacity is still whatever the existing configuration says. Confirm the recipient and the full text before a reply goes out. An authorization that is already explicit can be carried out directly. If a reply fails, send only the reply again. Do not redo a release that is already finished.

## Feishu notifications

The rules register a `feishu` channel by default. Replace `ou_REPLACE_ME` with the owner's open_id. Under `channels.feishu` in the existing `config.json`, set this person's `user` and the channel key you already have. Reuse the Feishu channel that is already running. Do not open another listener. If it is not connected yet, finish that from [channel setup](../../../skills/agent-autoloop/SKILL.en.md#connect-a-channel). When the configuration involves a new key or new permissions, get the owner's approval first.

Business data is read as the owner. Notifications use the bot. By default it goes only to the owner. One hub hands a card to every channel it has configured. A rule that holds private data sets `channels`, and sends only to the channel of the owner's private chat. Do not mix in a shared group channel. Do not commit keys, a real open_id, a table token, or business data to the repository.
