# 飛書週報與業務摘要

[简体中文](README.md) | **繁體中文** | [English](README.en.md)

> 這份由 `scripts/docs.ts` 從簡體中文版自動轉換，改內容請改簡體中文版。

以本人許可權讀彙報、對照專案表，整理進展與待協調事項。預設週日北京時間 18 點讀取過去七天的指定彙報和指定表格當前狀態；完整讀取後才呼叫 Agent，完整稿儲存在本機，飛書給本人不含敏感明細的簡短摘要。

## 怎麼啟用

1. 把本目錄複製到 `~/.agent-autoloop/work/feishu-brief/`，目錄許可權設為 `0700`，不要放進 Git 倉庫。兩條規則使用同一台電腦、同一 `cwd` 和同一 `group`，讀取和整理序列執行。
2. 把 `SKILL.md` 放到 `~/.codex/skills/feishu-brief/`；Claude Code 放到 `~/.claude/skills/feishu-brief/`。
3. 安裝已登入本人身份的 `lark-cli`，先看 `lark-cli api --help` 和 `lark-cli base +record-list --help`，確認支援模板中的命令。只沿用已有授權，不在腳本里儲存或匯出 access token。
4. 修改 `sources.json`：`reportRule` 是已有彙報規則的準確名稱，`reportUsers` 是需要彙總且本人有權檢視的人員 open_id；`tables` 填自己的多維表格 token、table ID、原連結和必要欄位名。不需要表格就填空陣列。佔位標識不能直接用，模板不會建立表格或擴大許可權。
5. 合併規則的 `sources`、`agents`、`channels`、`rules`，替換接單電腦和路徑；時區用 `Asia/Shanghai`。許可權：`edit`，摘要 Agent 僅需讀資料、寫本地稿；聯網讀取由固定指令碼完成，它只執行讀取命令。
6. 執行 `agent-autoloop check`。在專用測試中控台用假 CLI 驗證採集、摘要派發、登入失效後的提問與續辦，再啟用自己的定時規則。

## 讀取與儲存範圍

彙報介面為 `POST /open-apis/report/v1/tasks/query`，這是查詢操作，所需許可權為 `report:task:readonly`。所有讀取均使用 `--as user`，只拿本人發起和收到的彙報，再按人員、規則、時間過濾；不會切到機器人身份獲取更多資料。介面規範見[飛書查詢彙報任務](https://open.feishu.cn/document/server-docs/report-v1/task/query.md)。沒有看到某人的彙報，不等於他沒提交。附件圖片不會下載。

表格用 `base +record-list`，只讀取指定欄位，以 NDJSON 檔案與 manifest 檢查分頁。直到 `has_more=false` 才算完整；跨頁版本變化會報錯，不能把部分資料說成完整彙總。不寫回表格、OKR 或彙報。表格記錄是當前快照，不能直接當作本週增量。

臨時表格匯出在讀取結束後清理。完整本期資料儲存在 `weekly-input.json`（許可權 `0600`），摘要是 `briefs/<資料編號>.md`；它們屬於本人的業務資料，不提交、不公開，也不在飛書卡片裡附原文。新資料覆蓋輸入檔案後，舊的排隊事件不會錯誤使用新資料；完整歷史摘要由本人按自己的保留期限管理。

本人登入或授權失效時只發一張問題卡片，沒有 `brief.ready` 事件，不拿上次的檔案冒充本週結果。本人恢復後點繼續，重新完整讀取；選“本期先跳過”結束本輪，下次計劃時間再讀；臨時介面錯誤則如實失敗，由中控台現有機制處理。

## 飛書通知

規則預設登記 `feishu` 通道。把 `ou_REPLACE_ME` 換成本人的 open_id；在已有 `config.json` 的 `channels.feishu` 配上這個人的 `user` 和已有通道金鑰。複用已執行的飛書通道，不另開監聽。尚未接入時按[通道設定](../../../skills/agent-autoloop/SKILL.zh-TW.md#接一個通道)完成；設定涉及新金鑰或許可權時先取得本人授權。

讀取業務資料使用本人身份，通知使用機器人身份。預設只發給本人；一箇中控台預設把卡片交給它設定的所有通道；含私人資料的規則寫上 `channels`，只發到本人私聊的通道，不要混入共享群通道。不要把金鑰、實際 open_id、表格 token 或業務資料提交到倉庫。
