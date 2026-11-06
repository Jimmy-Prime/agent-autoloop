# Feishu weekly report and business brief
[简体中文](README.md) | [繁體中文](README.zh-TW.md) | **English**

It reads reports with the owner's own permissions, compares them with the project tables, and organizes progress and items that need coordinating. By default, at 18:00 Beijing time on Sunday, it reads the past seven days of the named reports and the current state of the named tables. It calls the agent only after a complete read. The full draft stays on this machine. Feishu gets a short summary for the owner, without the sensitive details.

## How to turn it on

1. Copy this directory to `~/.agent-autoloop/work/feishu-brief/`. Set the directory mode to `0700`. Do not put it in a Git repository. Both rules use the same computer, the same `cwd`, and the same `group`, so reading and organizing run one after the other.
2. Put `SKILL.md` in `~/.codex/skills/feishu-brief/`. For Claude Code, put it in `~/.claude/skills/feishu-brief/`.
3. Install `lark-cli` signed in as the owner. First read `lark-cli api --help` and `lark-cli base +record-list --help`, and confirm they support the commands in the template. Reuse authorization you already have. Do not save or export an access token in the script.
4. Edit `sources.json`. `reportRule` is the exact name of a report rule that already exists. `reportUsers` are the open_ids of the people to include, people the owner is allowed to see. In `tables`, fill in your own Base token, table ID, original link, and the field names you need. If you do not need a table, use an empty array. Placeholder identifiers cannot be used as they are. The template does not create tables or widen permissions.
5. Merge the rules' `sources`, `agents`, `channels`, and `rules`. Replace the worker computer and the paths. Use the time zone `Asia/Shanghai`. Permissions: `edit`. The summary agent only needs to read the data and write a local draft. The fixed script does the network reads, and it runs only read commands.
6. Run `agent-autoloop check`. On a dedicated test hub, use a fake CLI to check collection, dispatching the summary, and the question and continuation after login expires. Then turn on your own schedule.

## What is read and saved

The report API is `POST /open-apis/report/v1/tasks/query`. This is a query. The permission it needs is `report:task:readonly`. Every read uses `--as user`. It only takes reports the owner sent or received, then filters by person, rule, and time. It does not switch to the bot identity to fetch more data. The API is documented in [Query report tasks (Feishu)](https://open.feishu.cn/document/server-docs/report-v1/task/query.md). Not seeing someone's report does not mean they did not submit it. Image attachments are not downloaded.

Tables use `base +record-list`. Only the named fields are read, and pagination is checked with an NDJSON file and a manifest. It counts as complete only when `has_more=false`. A version change across pages is an error. Partial data must not be described as a complete summary. Nothing is written back to a table, an OKR, or a report. Table records are a current snapshot. They are not, by themselves, this week's delta.

The temporary table export is removed when the read finishes. The complete data for this period is saved in `weekly-input.json` (mode `0600`). The summary is `briefs/<data id>.md`. They are the owner's business data. Do not commit them, do not publish them, and do not attach the original text to the Feishu card. After new data overwrites the input file, an older event still waiting in the queue does not use the new data by mistake. The owner keeps the full history of summaries for as long as their own retention period says.

When the owner's login or authorization has expired, it sends only one question card. There is no `brief.ready` event. It does not pass off last time's file as this week's result. After the owner restores access and clicks continue, it reads everything again. Choosing “本期先跳过” (Skip this period) ends this round, and it reads again at the next scheduled time. A temporary API error fails as it is, and the hub's existing mechanism handles it.

## Feishu notifications

The rules register a `feishu` channel by default. Replace `ou_REPLACE_ME` with the owner's open_id. Under `channels.feishu` in the existing `config.json`, set this person's `user` and the channel key you already have. Reuse the Feishu channel that is already running. Do not open another listener. If it is not connected yet, finish that from [channel setup](../../../skills/agent-autoloop/SKILL.en.md#connect-a-channel). When the configuration involves a new key or new permissions, get the owner's approval first.

Business data is read as the owner. Notifications use the bot. By default it goes only to the owner. One hub hands a card to every channel it has configured. A rule that holds private data sets `channels`, and sends only to the channel of the owner's private chat. Do not mix in a shared group channel. Do not commit keys, a real open_id, a table token, or business data to the repository.
