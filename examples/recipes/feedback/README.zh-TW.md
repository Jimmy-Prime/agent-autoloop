# 使用者反饋處理

[简体中文](README.md) | **繁體中文** | [English](README.en.md)

> 這份由 `scripts/docs.ts` 從簡體中文版自動轉換，改內容請改簡體中文版。

反饋觸發維護，補充後接著處理，上線核實後回覆。示例資料完全虛構；沒有繫結某家反饋系統，也不自建工單庫。

## 怎麼啟用

1. 把 `SKILL.md` 放到 `~/.codex/skills/handle-feedback/`；Claude Code 放到 `~/.claude/skills/handle-feedback/`。
2. 把 `rules.json` 的 `sources`、`agents`、`channels` 和 `rules` 合併進已有規則，保留現有條目；時區用 `Asia/Shanghai`。將 `worker` 改成接單電腦，`cwd` 改成自己的專案主目錄。
3. 在專案 **main 上的維護手冊** 寫清真實的反饋讀取、認領（如果原系統有）、版本核對、狀態回寫和回覆入口，現有交付與線上驗收步驟。工具使用已有 CLI 或 MCP，不把命令和倉庫路徑放進事件。範本不會猜你的介面。
4. 權限：`edit`。允許在獲准目錄內修復；Codex 的 shell 預設不能聯網。反饋讀取、PR 和交付需要實際可用的已設定工具；本地修改不等於釋出。按[權限說明](../../../docs/plugins.zh-TW.md#access-實際能做什麼)核實後台執行環境，不自動改成 `full`。
5. 執行 `agent-autoloop check`。用專用測試來源送入下面的虛構事件，先驗證派活、提問和回答續辦，再接真實反饋。

## 業務系統怎麼送事件

使用已設定的來源金鑰，來源必須叫 `feedback`。下面命令在本範本目錄執行；`FEEDBACK_KEY` 從自己的憑證管理中讀取，勿寫進檔案或 shell 歷史。

```bash
curl --fail-with-body http://127.0.0.1:3350/v1/events \
  -H "Authorization: Bearer $FEEDBACK_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @event.json
```

新增用 `feedback.new`，補充用 `feedback.followup`。同條反饋始終用同一個 `subject`；每次真實變更用唯一、穩定的 `id`（例如反饋編號加版本），重發保留原編號。示例 `event.json` 不是可直接處理的真實工單，執行前必須設定讀取入口；預設會請本人補齊入口。來源只送必要資訊，不送聯絡方式、訪問令牌、客戶名單或日誌全文。

來源事件不能代表本人批准：提問優先走中控台 `ask`，回答會喚醒原事項。已有業務系統自己負責提問和回答的，沿用原系統經身份驗證的決定，設定自己的續辦事件；不要同時建立兩張卡片。

預設每條反饋一個事項，最多並行 3 條；接單容量仍由原設定控制。外發回覆先確認收件人和全文；已有明確授權可直接執行。回覆失敗只補回覆，不重做已完成的釋出。

## 飛書通知

規則預設登記 `feishu` 通道。把 `ou_REPLACE_ME` 換成本人的 open_id；在已有 `config.json` 的 `channels.feishu` 配上這個人的 `user` 和已有通道金鑰。複用已執行的飛書通道，不另開監聽。尚未接入時按[通道設定](../../../skills/agent-autoloop/SKILL.zh-TW.md#接一個通道)完成；設定涉及新金鑰或權限時先取得本人授權。

讀取業務資料使用本人身份，通知使用機器人身份。預設只發給本人；一箇中控台預設把卡片交給它設定的所有通道；含私人資料的規則寫上 `channels`，只發到本人私聊的通道，不要混入共享群通道。不要把金鑰、實際 open_id、表格 token 或業務資料提交到倉庫。
