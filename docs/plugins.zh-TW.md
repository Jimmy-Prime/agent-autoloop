# 寫外掛

[简体中文](plugins.md) | **繁體中文** | [English](plugins.en.md)

> 這份由 `scripts/docs.ts` 從簡體中文版自動轉換，改內容請改簡體中文版。

先看 [README 的內建外掛目錄](../README.zh-TW.md#外掛體系四個方向都能自由替換)選擇已有實現；需要擴充套件時，從下面三個可執行的最小范本開始，替換業務部分：

| 範本 | 已經演示了什麼 | 你要替換什麼 |
|---|---|---|
| [Agent 範本](../examples/plugins/hello-agent/agent.ts) | 用 `printf` 模擬執行，讀取輸出、會話編號和「收下了提示詞」 | 新 Agent 的啟動命令和輸出解析 |
| [通道範本](../examples/plugins/hello-channel/channel.ts) | 領卡片、寫到檔案、報告送達；通過命令列回答 | 目標平台的傳送、更新和回答回呼 |
| [事件外掛範本](../examples/plugins/hello-source/source.ts) | 驗證 HMAC-SHA256 簽名，把模擬訂單轉換成事件 | 業務系統的驗籤方式和欄位對映 |

事件外掛、接單程式、通道和命令列共用同一套 HTTP + JSON 介面。只用 Shell 接協議，可以看 [接單腳本](../examples/worker.sh) 和 [通道腳本](../examples/channel.sh)：設定中控台地址與金鑰後執行，需要 `curl`、`jq`。它們適合演示短任務；長任務使用內建接單程式的心跳、停止和恢復能力。

一個外掛就是一個目錄，入口為 `agent.ts`、`channel.ts` 或 `source.ts`。只用 `node:` 模組和自己目錄裡的檔案，型別在外掛裡宣告；不要相對引用引擎原始碼：裝在 `~/.agent-autoloop/plugins/` 的外掛，相對路徑到不了引擎。內建外掛和引擎放在一起釋出，才能直接引 `worker/agents.ts` 裡的 `findProgram`、`tail` 這些小工具，引擎不反過來引外掛。

用 `agent-autoloop add <git 地址>` 安裝到 `~/.agent-autoloop/plugins/<倉庫名>`，也接受本地 Git 倉庫。外掛名就是那個目錄名：倉庫名轉成小寫，只能用小寫字母、數字和 `-`，別的名字會被拒絕，並說出它算出來的名字；規則的 `use` 和來源的 `adapter` 都寫這個名字。它只克隆，不裝依賴、不跑安裝腳本、不自動更新。載入時會執行外掛，安裝目錄的同名外掛優先。

## 先跑起來

在引擎目錄執行這條命令：它把三個例子分別裝進臨時中控台，實際走完驗籤、派活、執行、通知和報告，退出後清理。

```bash
node --disable-warning=ExperimentalWarning --test --test-name-pattern='agent-autoloop add' tests/example-plugins.test.ts
```

## Agent 外掛

從 [hello-agent/agent.ts](../examples/plugins/hello-agent/agent.ts) 開始。它用 `printf` 代替模型，克隆到別處也能執行。收下提示詞和結束時各打一行，`read` 從第一行就知道這一輪接上了原會話，第二行是它的最後一條訊息。

| 匯出對象的方法 | 作用 |
|---|---|
| `command(turn)` | 返回命令參數陣列；參數不作為 shell 程式碼執行 |
| `read(stdout, code, stderr)` | 返回 `text`、`session`、`usage`、`sessionUsage`、`error`、`finished`、`started`；執行中 `code` 為 `null` |
| `link(session)` | 可選，開啟這個會話的連結。回條寫錯時，`read` 返回了 `session` 的外掛都只重寫回條，和有沒有連結無關 |
| `check()` | 可選，能用返回 `null`，否則返回下一步怎麼做 |

`turn` 包含 `prompt`、`session`、`resume`、`cwd`、`access`、`model`、`effort`、`command`、`contextFile`、`folder`。`contextFile` 是資料檔案，受限 CLI 需要允許讀取 `folder`。`read` 要能處理未寫完的輸出；CLI 真正完成後才返回 `text`。`read` 拋錯或什麼也不返回時，還在跑的接著跑，結束後這一輪算沒跑成，留在原會話重派。

支援 `resume` 的外掛，從 Agent 收下提示詞起都要返回 `started: true`，包括執行中和出錯之後。否則做到一半斷了，也會被當成會話接不上，開新會話把業務重做一遍。返回了 `session` 就要按 `turn.resume` 接回原會話：沒跑成的重派和寫錯回條的重寫都靠它；接不回去的 CLI 不要返回 `session`。

`usage` 是這次啟動用掉的量。有的 CLI 只給整個會話累計到現在的數（Codex 的 Token、Claude Code 的費用），這幾項放進 `sessionUsage`，同時要返回 `session`。接單程式啟動前記下這個會話上次的累計值，結束後相減，和 `usage` 合起來上報；這些記錄放在 `~/.agent-autoloop/worker/usage/`，接單程式中途重啟也不會多算。

沒有記錄的續接（換了電腦、升級前就有的會話）或累計值變小時，這幾項這次不報，不猜；下一次續接恢復正常。其他程式在同一個會話裡用掉的量分不出來，比如本人開啟連結接著聊，會算進下一次續接。CLI 改成只報單次時，外掛要把這幾項改回 `usage`，不要靠數字大小去猜。

在規則裡選擇這個外掛：

```json
{ "name": "Hello", "worker": "my-computer", "use": "hello-agent", "access": "read" }
```

只需要印出最後一條訊息時，用內建 `command` 加參數陣列即可，不必寫外掛。參數裡可以用 `{prompt}`、`{model}`、`{effort}`、`{cwd}`、`{context}`，每個參數只替換一輪，替換進去的提示詞原樣傳給程式：提示詞裡寫著 `{cwd}` 或 `$&`，到程式那邊也還是這幾個字，不會被再替換一次。執行時還有環境變數 `AGENT_AUTOLOOP_CONTEXT`（資料檔案）和 `AGENT_AUTOLOOP_RUN`（第幾輪）。

DeepSeek Harness 有內建 `dsh` 外掛，規則裡寫 `use: "dsh"`，要 0.2.2 或更新，`agent-autoloop doctor` 會查。現在 npm 的 `latest` 還是舊版，要這樣裝：`npm install -g @deepseek-ai/dsh@next --allow-scripts=koffi,node-pty,@deepseek-ai/dsh-subprocess-local`。新版 npm 預設不跑依賴的安裝腳本，不放行這三個包，裝完看著正常，一跑才出錯。從舊版升上來的，0.2.2 可能讀不到 `~/.dsh/.credentials.yaml` 裡的 `refs`，報 `MISSING_CREDENTIAL`：把金鑰放進環境變數，Linux 的系統服務放 `~/.config/environment.d/*.conf`。只上報 Token，不上報費用。有使用者在 WSL2 上用 0.2.2-rc.1 和第三方 OpenAI 相容服務實測跑通了問答、用量和 `resume`。它以 `dsh headless --json` 跑一輪，從 `session` 事件拿會話編號，用 `--session-id` 續接，把 `step_end` 的用量彙總為 Token，`final` 事件才算跑完；`access` 每次都對映成 `--permission-mode`，要人批准的呼叫用 `--approval-policy never` 直接拒絕。規則裡的 `model`、`effort` 不起作用，用 DSH 自己的設定。沒有可開啟的桌面會話連結。DSH 預設把會話日誌上傳給 DeepSeek，見[它的說明](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md)。

### 瀏覽器接入

瀏覽器工具裝在執行 Agent 的電腦上，由該 CLI 的工具設定或專案 Skill 提供。Codex 外掛啟動的是後台 [`codex exec`](https://developers.openai.com/codex/noninteractive/)；可以使用它已設定的 [MCP 工具](https://developers.openai.com/codex/mcp/)，不能只憑桌面應用能開啟網頁就認定後台也能訪問同一瀏覽器。

Claude 委託 Codex 的完整規則、Skill 和參數呼叫腳本見[瀏覽器交接範本](../examples/recipes/browser-handoff/README.zh-TW.md)。入口命令、目標與允許操作由本人設定；網頁助手返回證據和會話編號，主任務負責業務與回條。

已有專用瀏覽器入口時，在規則的 `prompt` 或 `skill` 寫明實際命令、會話接續方式和允許的操作。只交網頁步驟，返回看到的內容、操作結果和阻塞原因；主任務負責業務和中控台回條。瀏覽器入口不是必裝元件，中控台不捆綁某台電腦的腳本，也不自動修改 CLI 的工具設定。

需要網頁驗收的任務，要用同一後台啟動方式實際開啟目標頁面，核對內容並接續一次會話。缺少可用入口或需要本人恢復連線、登入、驗證時，保留未驗收項，用現有 `ask` 等待恢復；不要寫“沒跑成”觸發重派，也不能把 HTTP 查詢當作已經完成網頁驗收。

## 通道外掛

從 [hello-channel/channel.ts](../examples/plugins/hello-channel/channel.ts) 開始。它把卡片寫進檔案，用命令列回答。

預設匯出非同步函式，參數是 `{ hub, options, log, signal }`；`options` 來自 `config.json`，不含中控台金鑰。

| 呼叫 | 作用 |
|---|---|
| `hub.nextCard(50)` | 長輪詢領卡片，沒卡片返回 `{ card: null }` |
| `hub.delivered(id, version, ref)` | 報告送達，儲存外部訊息編號 |
| `hub.failed(id, version, error)` | 報告發送失敗 |
| `hub.answer(id, { choice, by, ref })` | 轉交回答；核對回答人和原訊息 |

`ref` 為空就發新訊息，有值就更新原訊息；不能更新時只報告。沒報告的卡片一分鐘後重派。`signal` 中止時退出；函式在此之前返回或拋錯，都記日誌並在 30 秒後重啟，所以它要一直執行。外掛和中控台在同一個行程裡：沒接住的錯誤只記日誌，不讓中控台退出。

在 `rules.json` 登記通道、用 `agent-autoloop key new channel cards` 取金鑰，再把下面這項放進 `config.json` 的 `channels`，重啟中控台：

```json
{ "cards": { "use": "hello-channel", "key": "通道金鑰", "file": "/tmp/cards.txt" } }
```

能收回呼的通道要在規則裡設定 `answerers`，沒設時通道里誰都能回答，`doctor` 會提醒；只能發文字的通道設定 `links: true`，傳送 `card.link`。拿到連結的人能回答這張卡片。

通道和中控台共用一個 Node 行程，外部呼叫應非同步等待。內建飛書通道的使用者查詢、傳送和更新均非同步呼叫 CLI，傳送期間中控台仍能接收事件和心跳。

## 事件外掛

從 [hello-source/source.ts](../examples/plugins/hello-source/source.ts) 開始。它檢查 `x-shop-signature` 中的 HMAC-SHA256，再把訂單變成事件。

預設匯出同步函式，參數為 `{ headers, body, secret }`。先驗籤，再解析原文；返回事件陣列，無事返回 `[]`，拒絕請求就拋異常。事件外掛只翻譯，不發請求。

在 `rules.json` 登記來源：

```json
{ "shop": { "name": "商店", "adapter": "hello-source" } }
```

請求地址是 `/v1/in/shop`；秘密放在 `secrets.env` 的 `AGENT_AUTOLOOP_SECRET_SHOP`（來源名轉大寫，`-` 換成 `_`；改完重啟中控台），不寫進規則。事件必須有穩定的 `id` 和合法的 `type`，可帶 `subject`、`summary`、`detail`、`link`，上限見[協議](protocol.zh-TW.md#來源把世界變成事件)。

來源能直接發標準 JSON 時不必寫外掛，用來源金鑰呼叫 `POST /v1/events` 即可。

## access 實際能做什麼

`access` 由外掛翻譯，不是中控台提供的系統沙箱。以下是未額外放寬本機權限時的行為。

| 外掛 | `read` | `edit` | `full` |
|---|---|---|---|
| Codex | `read-only`：能跑 shell，不能寫檔案，命令預設不能聯網 | `workspace-write`：能跑 shell、寫工作目錄和臨時目錄，命令預設不能聯網 | `danger-full-access`：能寫檔案、跑 shell、聯網，無審批 |
| Claude Code | `plan`：能讀檔案和執行只讀命令；其他命令取決於自動審批及本機規則 | `acceptEdits`：再允許目錄內檔案編輯和常見檔案操作；任意 shell 或聯網仍需放行 | `bypassPermissions`：跳過工具審批，沒有額外系統隔離 |
| DeepSeek Harness | `read-only`：不能寫檔案，讀檔案和聯網不受限 | `workspace-write`：命令和檔案改動限於工作目錄和臨時目錄，讀檔案和聯網不受限 | `danger-full-access`：不受限制 |
| ACP | Agent 來問時，同意讀和搜尋 | 再同意工作目錄內的編輯 | 同意它來問的所有操作 |

Codex 的三個檔位已用外掛命令實跑；DeepSeek Harness 和 Claude Code 分別依據 [DSH 文件](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md)和[官方權限說明](https://code.claude.com/docs/en/permission-modes)整理，沒有呼叫模型實跑。Codex 的命令網路限制與託管搜尋、MCP 不是同一個邊界，詳見[官方沙箱說明](https://learn.chatgpt.com/docs/agent-approvals-security)。使用者的 CLI 設定可能改變上述能力；`read` 也不代表讀不到本機金鑰。

ACP 的 `access` 只管 Agent 主動來問的操作。規範允許 Agent 不詢問就執行，這種操作 `access` 攔不住，要用 Agent 自己的模式限制，比如 `command` 裡寫 `env INITIAL_AGENT_MODE=read-only …`。ACP 的 `model`、`effort` 不生效，也要在 Agent 自己那邊設定。

場景範本據此選權限：早報用 `edit` 寫本地檔案，issue 用 `edit` 改程式碼並讓固定腳本聯網取正文，告警用 `read` 看程式碼和事件附帶的呼叫棧。反饋處理和飛書摘要用 `edit`，網站排查用 `read`；固定巡檢與飛書讀取腳本負責聯網，摘要 Agent 只讀完整快照。`command` 和固定腳本以本機帳號執行，不受 `access` 約束。

## 一致性測試

在引擎目錄執行協議的現有 HTTP 檢查，全部使用臨時資料和隨機埠：

```bash
node --disable-warning=ExperimentalWarning --test tests/conformance.test.ts
```

檢查其他中控台實現時，用 `agent-autoloop conformance <測試地址> --config <測試憑證檔案>`，檔案格式見[協議](protocol.zh-TW.md#一致性和復現)。它會寫事件和卡片，只對專用測試中控台執行。

外掛本身的完整接入測試見 [tests/example-plugins.test.ts](../tests/example-plugins.test.ts)。用其他語言寫獨立行程也可以，參考 [curl/jq 通道](../examples/channel.sh)和[接單程式](../examples/worker.sh)。
