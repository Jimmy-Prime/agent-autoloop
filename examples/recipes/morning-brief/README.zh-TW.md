# 每日早報

[简体中文](README.md) | **繁體中文** | [English](README.en.md)

> 這份由 `scripts/docs.ts` 從簡體中文版自動轉換，改內容請改簡體中文版。

## 解決什麼
每天早上整理當前目錄的筆記和提交，寫到 `briefs/YYYY-MM-DD.md`，不用聯網。

## 怎麼啟用
把本目錄的 `SKILL.md` 複製到 `~/.codex/skills/morning-brief/`；Claude Code 用 `~/.claude/skills/morning-brief/`。
把 `rules.json` 的 `agents`、`rules` 並進 `~/.agent-autoloop/rules.json`，然後檢查：
```bash
agent-autoloop check
```
規則幾秒內生效；把 cron 臨時設成 `* * * * *` 可在一分鐘內試跑。

## 要改哪幾處
- `worker` 換成 `agent-autoloop status` 顯示的接單電腦；`use` 選 `codex` 或 `claude`。
- `cwd` 換成已有的筆記目錄；`cron` 是當地時間，預設每天八點。
- 權限：`edit`。兩種外掛都能讀本地資料、寫早報；不需要聯網或任意 shell 命令，見[權限說明](../../../docs/plugins.zh-TW.md#access-實際能做什麼)。
