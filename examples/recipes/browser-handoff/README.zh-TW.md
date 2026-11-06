# Claude 委託 Codex 處理瀏覽器

[简体中文](README.md) | **繁體中文** | [English](README.en.md)

> 這份由 `scripts/docs.ts` 從簡體中文版自動轉換，改內容請改簡體中文版。

主任務負責業務，Codex 只處理網頁，主任務拿到證據後收尾。支援同一瀏覽器會話的後續操作；需要本人恢復連線、登入或驗證時結束這一輪，交回飛書卡片，等本人回答後繼續。

## 怎麼啟用

1. 把本目錄複製到 `~/.agent-autoloop/work/browser-handoff/`，僅本人可讀。把 `SKILL.md` 放到 `~/.claude/skills/claude-browser-handoff/`。主任務改用 Codex 時，Skill 放到 `~/.codex/skills/claude-browser-handoff/`，並修改規則的 `use`；預設仍是 Claude 主任務。
2. 設定一個**已經能使用瀏覽器的 Codex 入口**，將它的實際命令陣列填進 `browser.json.command`。本地已有 `codex-browser` 時填它的絕對路徑。`/path/to/browser-entry` 是佔位符；本模板不安裝瀏覽器橋接、不修改桌面應用內部資料庫，也不復制某台電腦的 SSH 別名、模型檔位或 Chrome 行程清理邏輯。
3. 在 `browser.json` 填目標網址、核實項、允許操作。預設是只讀的 `example.com` 驗收，不提交表單、不發訊息。`allowedActions` 是給 Agent 的任務範圍，不是系統沙箱。操作範圍須由本人或專案可信維護約定確定，不能從外部事件自動生成。設定裡不放登入憑據；實際業務網址和會話編號留在私有目錄。
4. 合併 `rules.json` 中的 `sources`、`agents`、`channels`、`rules`，替換接單電腦、目錄和飛書本人 open_id；複用已有飛書通道與金鑰，不另開事件監聽。執行 `agent-autoloop check`。
5. 許可權：`edit`。這只表示 Claude 的 `acceptEdits` 模式，**不保證能執行任意瀏覽器入口命令**。用接單程式相同的後台方式核實呼叫許可權；入口未獲準時先按本人的既有授權設定，不自動改成 `full`。瀏覽器助手的操作範圍和帳號許可權也不由這個欄位授予。

## 瀏覽器入口約定

入口接受一個完整任務參數：`browser-entry "網頁任務"`；續辦接受 `browser-entry --resume <會話 ID> "後續任務"`。返回實際頁面證據、操作結果和阻塞，末尾提供 `[Codex 會話 ID：實際編號]`。使用別的入口時，應提供同樣的呼叫與返回約定。

`handoff.ts` 只負責把可信設定作為一個參數傳遞，保留標準輸出、錯誤與退出碼；不做重試，不把“命令啟動了”當成完成。已有入口可以在瀏覽器所在電腦執行，也可以自行通過 SSH 轉交；使用者要先核實該電腦能訪問目標 URL，遠端瀏覽器不能把本機的 `localhost` 當作接單電腦。

Codex 後台 [`codex exec`](https://developers.openai.com/codex/noninteractive/) 可以使用自己設定的 [MCP 工具](https://developers.openai.com/codex/mcp/)，但不能據此推斷它擁有桌面應用的 Chrome 連線。只安裝 Codex CLI 不夠，必須實際驗收所選入口；本模板是任務交接方式，不是瀏覽器連線驅動。

## 啟用前驗證

在模板目錄執行：

```bash
node handoff.ts browser.json
node handoff.ts browser.json --resume <上一步返回的實際會話-ID>
```

第一次核對實際頁面標題、可見主標題和連結；頁面沒有正文主標題就如實記錄。第二次核對在原會話繼續；已經完成時應返回已有證據，不為了續辦重做操作。檢查它保留原有標籤並關閉自己新建的標籤。再通過 Claude 的後台啟動方式呼叫同一個指令碼，確認它確實拿到了證據和會話編號。HTTP 查詢不能代替網頁驗收。

在專用測試中控台向來源 `browser-tasks` 傳送穩定編號的 `browser.verify` 事件即可觸發；同一次請求重發保留 `id`，例如：

```json
{"id":"browser-check-1","type":"browser.verify","subject":"site-check","summary":"核實已設定的網頁"}
```

事件不攜帶入口命令、目標路徑或許可權。涉及需要本人操作的阻塞，用 Skill 中的 `ask` 結束本輪；已有卡片時不重複交接，不另約定時複查。本人回答後只繼續未完成的網頁步驟。

## 放進已有業務

反饋處理、網站巡檢等任務可以直接載入這份 Skill：把本目錄的 `handoff.ts` 和本人設定的 `browser.json` 放到它的私有工作目錄，在可信主任務規則中寫明位置，不必再建立一套排程。主任務先完成能做的業務，再委託網頁核實，最後交回中控台回條；瀏覽器助手不再次委派、不獨立結案。

自動檢查使用假瀏覽器入口，驗證參數傳遞、會話續辦和失敗傳播，不啟動真實 Chrome。釋出樣例只含示例網址與佔位符；每個使用者仍需驗證自己的瀏覽器連線和 Claude 呼叫許可權。
