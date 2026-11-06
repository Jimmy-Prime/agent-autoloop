# Agent Autoloop

[简体中文](README.md) | **繁體中文** | [English](README.en.md)

> 這份由 `scripts/docs.ts` 從簡體中文版自動轉換，改內容請改簡體中文版。

**讓你的命令列 Agent 在後台自己接活、自己跟進到底；平時不煩你，遇到拿不準的事才發卡片找你拍板。**

> 這是 [KKKKhazix/agent-autoloop](https://github.com/KKKKhazix/agent-autoloop) 的 fork：補上台灣、美國常用的軟體（先做 Telegram），並提供繁體中文與英文介面。安裝與 `update` 跟著這個 fork 自己的 Release。

[上手](#上手) · [場景範本](#拿來即用的場景範本) · [外掛](#外掛體系四個方向都能自由替換) · [核心](#核心的四個機制) · [文件](#更多文件)

![架構圖](docs/architecture.zh-TW.svg)

## 它解決什麼問題？

平時我們用 Claude Code、Codex 這類命令列 Agent，大多是“人守著終端機用”：你輸一句話，盯著它跑，等它問你下一步；一旦關掉視窗或者人走開，事情就斷了。

**Agent Autoloop** 是一個極輕量的自動化中控台。它把任務排程做成一個零外部依賴的**核心**，把事件來源、Agent、通知通道，甚至程式碼上線流水線全部拆成可隨時插拔的**外掛**。

- **一台電腦、一條命令就能跑。** 裝在你的 Mac 或 Linux 上，不用買雲伺服器，也不用開放公網埠。
- **一行設定接新 Agent。** 不需要 SDK，也不需要改 Agent 原始碼，能接收提示詞並印出最後一條回覆的命令列工具都能接。
- **沒有後台介面。** 需要你拍板時把卡片推到飛書、釘釘、企微、Slack、Discord 或桌面通知；想看整體進展，敲一行命令。

## 上手

支援 macOS 和 Linux。執行前需要裝好 Node 24、Git、curl，以及任意一個你已經登入好的命令列 Agent，不需要 GitHub 帳號。也可以直接把[安裝說明](INSTALL.zh-TW.md)丟給你的 Agent，讓它替你裝好。

> **Windows：還不支援。** 上游正在開發，進度見上游的 [#17](https://github.com/KKKKhazix/agent-autoloop/issues/17)。現在可以先用 WSL2，注意事項見 [INSTALL](INSTALL.zh-TW.md)。

```bash
curl -fsSL https://raw.githubusercontent.com/Jimmy-Prime/agent-autoloop/main/install.sh | sh
```

安裝和 `agent-autoloop update` 都裝最新的 [Release](https://github.com/Jimmy-Prime/agent-autoloop/releases)，那是通過了全部檢查的版本。

裝好後用你本機的 Agent 真實走一遍“提問 → 退出等回覆 → 拍板 → 接著幹完”：

```bash
agent-autoloop try
```

下面是在終端機裡的真實輸出：

```text
事件發出去了，Agent 開始幹活……

Agent 結束了這一輪，問了你一個問題。它現在不佔行程、不花 Token。

【等你決定】#1 試跑：選一個顏色
這是一次試跑，選哪個都行。
  1. 藍色
  2. 綠色
回答：agent-autoloop answer 1 <序號>
答完執行 agent-autoloop status，能看到它接著把活幹完。
```

互動終端機裡直接輸入數字回車；非互動終端機執行 `agent-autoloop answer 1 2` 選擇“綠色”。再跑 `agent-autoloop status`，就能看到它接上剛才的會話並顯示“你選了綠色，試跑通過”，還有今天和最近 7 天的輪數、Token 和費用（[統計口徑](skills/agent-autoloop/SKILL.zh-TW.md#看情況回答)）。

## 一件事怎麼轉起來

編號和上面的架構圖一一對應：

1. **新事件進來。** 早上 9 點的定時任務、GitHub 上新提的 Issue、業務系統報的錯，都變成一條標準事件送進核心。
2. **按規則派活。** 核心照你寫的規則，決定交給哪個 Agent、去哪個目錄幹。同一件事排隊時又來的訊息，會合併成一輪處理。
3. **幹完一輪就退出。** Agent 把結果寫在最後一條回覆裡，行程直接退出。
4. **拿不準才問你。** 碰到刪資料、重啟服務、花錢、對外發訊息這類事，核心通過飛書或桌面通知發一張卡片給你。等你回覆期間，它不佔後台行程，也不消耗 Token。
5. **點一下，接著幹。** 你選完，它接上原來的對話，把剩下的活幹完。

能自己搞定的事走圖上方的自動閉環：直接辦完，或者約個時間（比如半小時後）再醒來復查，全程不打擾你。

## 日常怎麼配？

### 寫一份規則（`rules.json`）

不需要寫膠水程式碼。開啟 `~/.agent-autoloop/rules.json`，在 `rules` 裡寫清楚**什麼事、交給誰、在哪個目錄幹**。`to` 填 `agents` 裡已有的名字。比如每天早上 9 點寫早報：

```json
{
  "name": "早報",
  "when": { "cron": "0 9 * * *" },
  "to": "codex",
  "cwd": "~/notes",
  "prompt": "整理昨天的筆記和提交，寫今天的早報。"
}
```

外部事件寫法一樣，只是要先接好來源。比如有人提新 Issue 時交給 Codex，先按[說明](skills/agent-autoloop/SKILL.zh-TW.md#接一個事件外掛)在 `sources` 裡登記 `github`：

```json
{
  "name": "處理 issue",
  "when": { "source": "github", "types": ["issues.opened"] },
  "to": "codex",
  "cwd": "~/code/app",
  "skill": "handle-issue",
  "parallel": 3
}
```

`agent-autoloop pause <規則>`、`resume <規則>` 暫停和恢復一條規則，暫停期間到點不跑、來事件不接，恢復後不補跑；`agent-autoloop run <規則>` 立即跑一輪。這些記在中控台的日誌裡，不改 `rules.json`。

儲存後幾秒內自動生效，可以執行 `agent-autoloop check` 檢查，`agent-autoloop check <檔案>` 檢查一份草稿，不碰正在跑的中控台；`agent-autoloop rules explain` 看生效的規則和下次定時，`agent-autoloop emit <型別> --dry-run` 預演一條事件會派給誰（不連線中控台、不寫日誌）。就算改錯了，或者檔案被刪、讀不到，系統也會繼續按舊規則跑，並行卡片提醒你。

### Agent 怎麼跟中控台配合？

中控台對 Agent 只有一個約定：**在最後一條回覆裡交代結果**。事情辦完了，正常輸出一句結論就行。需要向你請示時，在回覆末尾附一段 `agent-autoloop` 程式碼塊：

````text
訂單已經核對完畢，庫存充足。

```agent-autoloop
{
  "ask": [{
    "title": "怎麼發貨？",
    "text": "兩種方式今天都能發出。",
    "options": ["快遞", "自提"],
    "key": "shipping"
  }]
}
```
````

除了提問（`ask`），還能發通知（`notice`）、關閉已解決的卡片（`resolve`）、預約複查（`later`）和觸發新事件（`events`）。通告不需要回答，但結案時可以順手寫一句處理說明，這句話會留在卡片上；只是告訴一聲的通告標成 `fyi`，不帶按鈕。萬一 JSON 寫錯了，中控台只讓它在原會話裡重寫最後這段回覆，不會把已經幹完的業務重做一遍；重寫也失敗時，保留原結論並通知你回條沒有生效（通用命令沒有會話，直接走這一步）。接著舊會話跑也一樣：會話接不上才開新的；接上了、幹到一半斷了，就算沒跑成，過幾分鐘回到原會話重試，不開新會話重做。同一事項的新事件預設開新會話；規則寫 `"resume": true` 就接著上一輪的會話。

## 拿來即用的場景範本

每套範本都帶規則、任務 Skill 和啟用說明。

| 想做什麼 | 已經封裝好的流程 |
|---|---|
| [每日早報](examples/recipes/morning-brief/README.zh-TW.md) | 預設每天 8 點整理本地筆記和 Git 提交，寫入 `briefs/YYYY-MM-DD.md` |
| [跟進 GitHub Issue](examples/recipes/github-issues/README.zh-TW.md) | 每 5 分鐘查新 Issue，在本地改程式碼並通知你檢視；不提交、不推送、不回覆 Issue |
| [線上告警排查](examples/recipes/ops-alerts/README.zh-TW.md) | 接收報錯、對照程式碼查原因，需要重啟時發卡片詢問，回答後繼續 |
| [使用者反饋處理](examples/recipes/feedback/README.zh-TW.md) | 重讀反饋當前狀態、修復、交付核實、準備回覆；需要決定時飛書問你，回答後繼續 |
| [網站巡檢](examples/recipes/website-watch/README.zh-TW.md) | 每 5 分鐘檢查狀態和關鍵內容，首次異常交給 Agent，持續異常不重複通知，恢復後更新原卡片 |
| [飛書週報與業務摘要](examples/recipes/feishu-brief/README.zh-TW.md) | 週日 18 點按你的權限讀彙報和指定表格，生成本地摘要；飛書只發簡短摘要，完整稿留在本機 |
| [PR 自動交付](skills/agent-autoloop/SKILL.zh-TW.md#交付流水線) | 打上 `deliver` 標籤後，審查、等 CI、合併、等釋出並核對線上版本 |

**啟用：** 開啟對應說明，把任務 Skill 放進所用 Agent 的 skills 目錄，把示例規則合入 `~/.agent-autoloop/rules.json`，替換電腦名和路徑，再執行 `agent-autoloop check`。

反饋處理、網站巡檢和飛書摘要預設使用北京時間，只發給本人的飛書私聊。樣例資料都是虛構的；腳本和回條只用本地 HTTP 與假飛書 CLI 驗證過，沒有在真實帳號上跑過完整業務。

更多範本：[Claude 委託 Codex 處理網頁](examples/recipes/browser-handoff/README.zh-TW.md)、[每週程式碼清理](examples/skills/weekly-sweep/SKILL.md)、[交付 PR](examples/skills/ship-pr/SKILL.md)。

## 外掛體系：四個方向都能自由替換

內建外掛隨程式安裝，填好設定即可啟用；第三方外掛用 `agent-autoloop add <git 地址>` 安裝。

| 方向 | 內建 | 設定 |
|---|---|---|
| **事件**：怎麼發現新活 | [GitHub Webhook](plugins/github/source.ts)、[GitLab Webhook](plugins/gitlab/source.ts)、[HTTP 介面](docs/protocol.zh-TW.md#來源把世界變成事件)、[定時規則](skills/agent-autoloop/SKILL.zh-TW.md#改規則)、[Issue 輪詢腳本](examples/watch-github-issues.sh) | [說明](skills/agent-autoloop/SKILL.zh-TW.md#接一個事件外掛) |
| **Agent**：誰來幹活 | [Claude Code](plugins/claude/agent.ts)、[Codex](plugins/codex/agent.ts)、[ACP](plugins/acp/agent.ts)、[DeepSeek Harness](plugins/dsh/agent.ts)、[通用命令](plugins/command/agent.ts) | [說明](skills/agent-autoloop/SKILL.zh-TW.md#接一個-agent) |
| **通道**：去哪找你拍板 | [桌面通知](plugins/desktop/channel.ts)（預設開啟）、[Telegram](plugins/telegram/channel.ts)、[飛書](plugins/feishu/channel.ts)、[釘釘 / 企微 / Slack / Discord](plugins/webhook/templates.ts) | [說明](skills/agent-autoloop/SKILL.zh-TW.md#接一個通道) |
| **交付**：把 CI/CD 也做成外掛 | [`delivery`](plugins/delivery/delivery.ts) | [說明](skills/agent-autoloop/SKILL.zh-TW.md#交付流水線) |

**實測情況：** Claude Code、Codex 和 ACP（官方 Codex ACP 介面卡）跑通了多輪問答和跨行程會話續接；飛書跑通了傳送、按鈕回呼和卡片更新；Telegram 只在本地模擬的 Bot API 上驗證過傳送、按鈕回呼和改訊息，還沒連過真實的 Telegram；四種 Webhook 範本只在本地模擬服務上驗證過，GitLab Webhook 按官方文件的格式測試，沒連過真實 GitLab。這些文字通道靠回答連結拍板，要把 `hub.publicUrl` 配成手機或電腦能開啟的地址。

**其他命令列 Agent 一行接入。** 設定 `use: "command"` 並傳入命令陣列，`{prompt}` 作為獨立參數傳遞，不會被當成 shell 程式碼執行。下面的命令整理自各家官方文件，我們還沒有逐個跑過：

| Agent | 接入命令 |
|---|---|
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cli-help.md#dsh-headless) 舊版（內建外掛要 0.2.2 或更新） | `dsh --profile headless {prompt}` |
| [pi](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli.md) | `pi --print {prompt}` |
| [OpenClaw](https://docs.openclaw.ai/cli/agent) | `openclaw agent exec {prompt}` |
| [Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/cli) | `hermes chat -Q -q {prompt}` |
| [Cursor](https://cursor.com/docs/cli/reference/parameters) | `agent -p --trust {prompt}` |
| [WorkBuddy / CodeBuddy](https://www.codebuddy.ai/docs/cli/headless) | `codebuddy -p {prompt}` |

**交付流水線。** 給 GitHub PR 打上 `deliver` 標籤後，它會自己跟進到上線：**審程式碼 → 等 CI → 合併 PR → 等部署 → 核對線上版本**。審查和交付設定只從 `main` 讀取，絕不在接單電腦上檢出或執行 PR 裡的程式碼；排隊、並行和重試直接複用核心。

**寫自己的外掛。** 從 [Agent](examples/plugins/hello-agent/agent.ts)、[通道](examples/plugins/hello-channel/channel.ts)、[事件](examples/plugins/hello-source/source.ts) 三個可執行的最小范本開始，見[外掛開發說明](docs/plugins.zh-TW.md)。要讓 Agent 操作網頁，先看[瀏覽器接入](docs/plugins.zh-TW.md#瀏覽器接入)。命令列和 [MCP](skills/agent-autoloop/SKILL.zh-TW.md#mcp-與金鑰撤銷) 也能檢視和回答卡片。

## 核心的四個機制

核心約 1650 行程式碼、零執行時依賴。它不讀系統時鐘、不用隨機數、不向外發請求，外掛主動連進來，帳號憑證留在各自的外掛裡；同樣的輸入永遠得出同樣的結果。它把四個計算機領域的成熟做法用到了命令列 Agent 上：

- **掛起零消耗**：等你拍板時行程直接退出，等待狀態存在資料庫裡，Agent 不用一直掛著。你三天沒回，這三天就沒有 Agent 行程在跑、不花 Token，只有很輕的中控台在後台等著；你一回答，它接著原來的對話繼續幹。
- **事件溯源**：所有狀態都從一條只追加的日誌算出來，日誌和索引在同一個交易裡寫進磁碟，寫完才應答。行程被強殺，已經確認的事不丟（整機斷電沒有單獨測過）；任何一輪為什麼跑、結果是什麼，一條命令就能查清；資料格式變了就從日誌重建，不用寫遷移腳本。
- **指令資料分離**：思路和 SQL 參數化一樣。Issue 的標題和正文等外部文字只作為資料放進檔案，不拼進提示詞，提示詞裡只有校驗過字元的型別、編號和連結；用哪個 Agent、在哪個目錄、什麼權限，只由你本機的規則決定，事件裡帶 `cwd`、`agent`、`access` 欄位會被直接拒收。
- **跳數熔斷**：思路和網路包的 TTL 一樣。Agent 交回的事件會再派給 Agent，層數一路累加，經過人工提問和定時複查也不清零，Agent 自己改不了；超過 8 層就只記錄、不再派活，並行一張卡片告訴你。

### 自己跑一遍

在程式目錄 `~/.agent-autoloop/app` 下執行：

| 驗證什麼 | 命令 |
|---|---|
| 任何一輪的來龍去脈 | `agent-autoloop why 1` |
| 20 萬步模擬斷網、丟包、崩潰和重複提交，一個種子就能復現 | `node sim/random.ts 24301 200000` |
| 強殺行程 1000 次，已確認的記錄一條不丟 | `node sim/crash.ts 1000 12648430` |
| 下面的效能數字 | `npm run benchmark` |

```text
第 1 輪 · 演示
11-03 20:47:25  規則版本 #1
11-03 20:47:25  觸發事件：來源 local · 型別 demo.start · 對象 example
11-03 20:47:25  local 領取（演示程式）
11-03 20:47:25  結束：演示完成
```

### 實測效能

Apple M5 Pro、24 GB、Node 24.21.0。寫入逐條提交，交易落盤後才應答。

| 指標 | 實測 |
|---|---:|
| 冷啟動 | 88.78 ms |
| 空閒記憶體 | 59.94 MB RSS |
| 1000 個同時等待的長輪詢 | 170.49 MB RSS |
| 持久化寫入 | 2394 條/秒 |
| 派活 p99 | 1.82 ms |
| 排隊 5000 時被擋下的心跳 p99 | 1.66 ms |
| 110 萬條事即時的啟動 | 99.8 ms |
| 核心行數（含空行和註釋） | 約 1650 |
| 執行時依賴 | 0 |

歷史變大後，狀態彙總會變慢，日誌和索引也繼續佔磁碟；格式變化後的首次啟動要從日誌全量重建，110 萬條用時 43.1 秒。[完整資料和測法](docs/protocol.zh-TW.md#歷史增長實測)。

## 用量與合規說明

中控台直接呼叫你本機已經安裝並登入好的命令列工具，不會讀取或轉存你的帳號憑證。模型呼叫消耗算在你自己的帳號名下，額度和使用範圍遵循各家模型廠商的服務條款。

在高頻自動化場景下，各家廠商通常更建議使用 API Key（個人訂閱額度主要是為日常人工互動設計的，詳見 [Anthropic](https://code.claude.com/docs/en/legal-and-compliance) 與 [OpenAI](https://learn.chatgpt.com/docs/auth) 的官方說明）。如果你用它對外提供服務，請使用 API Key。本專案為獨立開源專案，與上述廠商無隸屬或背書關係。

## 更多文件

- [安裝說明](INSTALL.zh-TW.md)
- [規則與交付流水線設定手冊](skills/agent-autoloop/SKILL.zh-TW.md)
- [如何編寫外掛](docs/plugins.zh-TW.md)
- [完整通訊協議](docs/protocol.zh-TW.md)
- [安全邊界說明](SECURITY.zh-TW.md)
- [參與貢獻與交流](CONTRIBUTING.zh-TW.md)
- [專案開發約定](AGENTS.md)

<details>
<summary><strong>倉庫目錄</strong></summary>

| 位置 | 放什麼 |
|---|---|
| `kernel/` | 核心：決策、事實日誌、狀態投影、到期任務、規則匹配、介面行為與卡片表單 |
| `host/` | 執行外殼：Node HTTP、檔案與 SQLite 連線、時鐘、設定、狀態彙總、後台服務和外掛載入 |
| `protocol/` | 通訊格式、JSON Schema、輸入校驗、HTTP 客戶端和一致性檢查 |
| `worker/` | 接單程式：領活、執行 Agent、心跳與停止、讀取和提交回條 |
| `cli/`、`bin/` | 使用者命令及啟動入口，包括狀態、回答、`why`、MCP、更新與解除安裝 |
| `plugins/` | 內建 Agent、事件、通道和交付外掛 |
| `examples/recipes/` | 完整場景：規則、任務 Skill 和啟用說明 |
| `examples/plugins/`、`examples/skills/`、`examples/*.sh` | 最小外掛範本、獨立任務手冊和 Shell 示例 |
| `skills/agent-autoloop/` | 中控台的正式設定與操作手冊，安裝時也提供給 Agent 使用 |
| `docs/` | 通訊協議、外掛開發說明與中英文架構圖 |
| `tests/`、`sim/` | 日常行為測試，以及模擬、窮舉、強殺和變異檢查 |
| `scripts/`、`.github/workflows/` | 效能與真機驗證、安裝冒煙腳本，以及 Linux / macOS CI |
| 根目錄文件與 `install.sh` | 中英文 README、安裝說明、安全邊界、開發約定、許可證與安裝腳本 |

讀程式碼可以從 `bin/agent-autoloop.ts` → `cli/main.ts` 開始，再按功能進入 `host/`、`worker/` 或 `plugins/`；核心設計先看[協議](docs/protocol.zh-TW.md)。同名檔案分屬不同層：`host/http.ts` 轉換 Node 請求，`kernel/http.ts` 定義介面行為；`protocol/rules.ts` 校驗輸入，`kernel/rules.ts` 定義規則型別和匹配。

</details>

[MIT License](LICENSE)
