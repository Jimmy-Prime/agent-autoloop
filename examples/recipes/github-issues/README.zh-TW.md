# 跟進 GitHub issue

[简体中文](README.md) | **繁體中文** | [English](README.en.md)

> 這份由 `scripts/docs.ts` 從簡體中文版自動轉換，改內容請改簡體中文版。

## 解決什麼
每五分鐘讀新 issue，在本地改程式碼並通知你檢視；不提交、不推送、不回覆 issue。

## 怎麼啟用
把本目錄的 `SKILL.md` 複製到 `~/.codex/skills/handle-issue/`；Claude Code 用 `~/.claude/skills/handle-issue/`。
把 `rules.json` 的 `sources`、`agents`、`rules` 並進 `~/.agent-autoloop/rules.json`，然後檢查：
```bash
agent-autoloop check
```
接單電腦需要已登入的 `gh`；輪詢指令碼把正文一併交給 Agent。

## 要改哪幾處
- 兩處 `worker` 換成接單電腦；`use` 選 `codex` 或 `claude`。
- `owner/repo` 換成倉庫，`created:>=2026-11-04` 換成啟用日期；`cwd` 換成乾淨的專案目錄。
- 許可權：`edit`。Agent 只讀資料、改本地檔案；聯網由固定輪詢指令碼完成，它不受 `access` 限制。Claude 預設不放行任意測試命令，見[許可權說明](../../../docs/plugins.zh-TW.md#access-實際能做什麼)。
