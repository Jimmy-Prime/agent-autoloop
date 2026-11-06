# taiwan 分支盤點

目標：把生態圈換成台灣、美國常用的軟體，並把介面與文件翻成台灣繁體中文。這份是清單，照 AGENTS.md「審計結果先交清單，不默認當批全修」，還沒有改任何程式。

盤點基準：`main` 在 `25ea762`，2026-11-06。數字由腳本掃 `git ls-files` 得出（漢字數只算 U+3400–U+9FFF）。

---

## 0. 決定（2026-11-06）

| # | 問題 | 決定 |
|---|---|---|
| D1 | 介面語言 | 簡體、繁中、英文三種都留。簡體是原文，跟上游一致 |
| D2 | 翻譯方式 | 做多語系層，設計見 §5 |
| D3 | 先做哪個互動通道 | Telegram。Slack、Discord 之後有環境再試 |
| D4 | 中國生態的插件 | 保留程式碼，只調整文件 |
| D5 | 飛書週報模板 | 先不做替代品 |
| D6 | 自己發 Release | 要。從 `taiwan` 分支發，`main` 只跟上游 fast-forward，同步時把 `main` 合進 `taiwan`（2026-11-06）。版本號接著上游：比上游發過的大，Release 說明寫基於上游哪一版。上游的 tag 不推進 fork |
| D7 | 術語 | 照 §3.4 的建議。有多個選項的取第一個：中台→中控台、通道→通道、拍板→拍板、插件→外掛、进程→行程 |

## 進度

| 批次 | 狀態 |
|---|---|
| 0：fork 基礎（§1） | 已 commit。安裝、`update`、連結都指向 `Jimmy-Prime/agent-autoloop`；Windows 段落改寫；README 加 fork 說明。在上游正式版的安裝上跑這個 fork 的安裝指令，會改成跟著這個 fork 的 Release（Codex 審查時找到：原本會失敗） |
| 1：協議字繁簡雙收（§3.2 前三項中的兩項） | 已 commit。第一行認「沒跑成」「沒事可做」；審查要點認 `## 審查要點`、`## Review checklist`。「已处理」「试跑」「试一下」併到批次 3，因為它們是我們自己產生的字，跟著語言切換一起改 |
| 2：Telegram 通道 | 已 commit。`plugins/telegram/channel.ts`，只在本機假 Bot API 上測過。架構圖還沒加 Telegram，併到批次 3 重畫 |
| 3a：語言設定一路傳下去 | 已 commit。`rules.json` 的 `language` 傳到內核、Job、卡片、`/v1/state`；`init --language`；安裝時照 `LANG` 選 |
| 3b：程式字串三語 | 已 commit。約 600 條 `` t`…` ``；繁中由 `scripts/words.ts` 產生，英文手工（Codex 翻、我驗收）；`install.sh` 自己的訊息也三語 |
| 3c：文件三語 | 已 commit。繁中文件由 `scripts/docs.ts` 產生；英文文件 13 份（Codex、Cursor Agent 翻，我驗收）；架構圖加上 Telegram |
| 4：場景模板、README 的 Agent 表 | 未開始 |

---

## 1. fork 本身：還指向上游的地方（必做）

不改這些，用 README 的指令安裝會裝到上游的程式；`agent-autoloop update` 也會把 taiwan 分支換回上游的 Release。

| 位置 | 內容 |
|---|---|
| `install.sh:4` | `PUBLISHED=https://github.com/KKKKhazix/agent-autoloop.git` |
| `cli/update.ts:6` | `PUBLISHED` 同上，`update` 從這裡找 tag |
| `package.json:7` | `repository.url` |
| `tests/releases.test.ts:26`、`tests/install.test.ts:62,230` | 測試寫死上游網址，要一起改 |
| `README.md:28,31`、`README.en.md:28,31`、`INSTALL.md:16` | 安裝指令與 Release 連結 |
| `skills/agent-autoloop/SKILL.md:164,185` | 交付 Action `uses: KKKKhazix/agent-autoloop/plugins/delivery@…`、遠端接單電腦的安裝指令 |
| `SECURITY.md:3`、`CONTRIBUTING.md:7-10` | 私密回報與討論區連結 |
| `.github/ISSUE_TEMPLATE/*.yml` | 討論區與 SECURITY 連結 |
| `README.md:25`、`README.en.md:25`、`INSTALL.md:7` | 原作者第一人稱的 Windows 出差說明（11/7、8 回家開發），fork 要改寫或拿掉 |

另外：GitHub 預設不跑 fork 的排程工作流程，`nightly.yml` 要到 Actions 頁手動啟用。

---

## 2. 生態圈替換

### 2.1 通道（去哪找你拍板）

現在唯一完整實測、能按按鈕回答的通道是飛書。它透過 `lark-cli` 長連線，往外連就收得到點擊，本機不用開公開網址（`plugins/feishu/channel.ts:1-3`）。其他文字通道只能發「回答連結」，手機要回答就得設定 `hub.publicUrl`。

| 現有 | 位置 | 台灣／美國替代 | 跟架構合不合 |
|---|---|---|---|
| 飛書（按鈕、回答者核驗、改卡片） | `plugins/feishu/channel.ts`、`tests/channels.test.ts`（39 處） | **Slack App（Socket Mode + Block Kit 按鈕）** | 合：往外連 WebSocket，不用公開網址，點擊帶 `user.id` 可核對 `answerers` |
| 同上 | 同上 | **Telegram Bot（`getUpdates` 長輪詢 + inline keyboard）** | 合：純往外的 HTTPS，`callback_query.from.id` 可核對回答者。手機推播最省事 |
| 同上 | 同上 | **Discord Bot（Gateway + 按鈕元件）** | 合：往外連 WebSocket；互動要 3 秒內回應 |
| 同上 | 同上 | LINE Messaging API | 不太合：收按鈕要 LINE 打進來的 webhook，需要公開 HTTPS；免費方案每月推播有上限（要查台灣方案）。LINE Notify 已在 2025-03-31 停止服務 |
| 釘釘、企微 webhook 模板 | `plugins/webhook/templates.ts:13-20`、`plugins/webhook/channel.ts`、`tests/webhook-templates.test.ts` | 新增 Telegram（`sendMessage`）、Google Chat（需 Workspace 帳號）、Microsoft Teams（舊的 Incoming Webhook connector 正被淘汰，新建要用 Workflows，要查最新文件） | 合：只往外發；同樣只能靠回答連結 |
| Slack、Discord webhook 模板 | 同上 | 保留 | 只在本機模擬服務驗證過，沒連過真平台 |
| 桌面通知 | `plugins/desktop/channel.ts` | 保留；可選加 ntfy、Pushover 手機推播 | — |

Node 24 內建 `WebSocket` 和 `fetch`，以上都不需要執行期依賴，符合「package.json 不寫 dependencies」。新通道是 `plugins/<名字>/channel.ts` 的純新增，不碰內核，同步上游時不會衝突，也可以推回上游。

### 2.2 Agent

| 現有 | 位置 | 建議 |
|---|---|---|
| DeepSeek Harness 內建插件 | `plugins/dsh/agent.ts`、`tests/dsh.test.ts`（45 處） | 程式保留（見 D4），README 降低露出 |
| README「一行接入」表裡的 WorkBuddy / CodeBuddy（騰訊） | `README.md`、`README.en.md` 的表格 | 換成台美常用的 CLI：Gemini CLI、GitHub Copilot CLI、opencode、Amp 等。指令參數要逐一對照官方文件，原表也註明「沒有逐個跑過」 |
| Claude Code、Codex、ACP、Cursor、OpenClaw、Hermes | — | 已是台美常用，不動 |

### 2.3 事件來源

GitHub、GitLab Webhook 和通用 HTTP `/v1/events` 本來就是全球通用的，不用換。可以考慮新增驗簽 adapter（`plugins/<名字>/source.ts`），排在通道之後：

- Sentry：搭配 `ops-alerts` 模板
- Linear 或 Jira：搭配 issue 模板
- PagerDuty

### 2.4 場景模板（`examples/recipes/`）

| 模板 | 中國生態的部分 | 要做的事 |
|---|---|---|
| `feishu-brief` | 整個綁飛書：`collect.ts` 用 `lark-cli` 以本人身分讀匯報和表格；`rules.json` 用 feishu 通道與 `Asia/Shanghai`；`SKILL.md` 寫北京時間；`tests/business-recipes.test.ts` 測它 | 見 D5：要重新設計（例如 Google Sheets 或 Notion 週報摘要），不是換字 |
| `feedback` | `rules.json:31-34` feishu 通道、`timezone: Asia/Shanghai`；README 說預設飛書私聊 | 通道換成 D3 的選擇；時區見 §2.5 |
| `website-watch` | `rules.json:50-53` feishu 通道、時區 | 同上 |
| `browser-handoff` | `rules.json:2` 時區；README 寫「交回飛書卡片」、要填飛書 open_id | 同上 |
| `ops-alerts`、`github-issues`、`morning-brief` | 沒有 | 只要翻譯 |

### 2.5 預設值與地區格式

| 位置 | 現在 | 建議 |
|---|---|---|
| `kernel/decide.ts:378` | `Intl.DateTimeFormat("zh-CN")` | `zh-TW`。這是內核改動，CI 會加跑 2 萬步模擬 |
| `cli/main.ts:361,418`、`cli/explain.ts:15` | `toLocaleString("zh-CN")` | `zh-TW` |
| `cli/spend.ts:4` | `Intl.NumberFormat("zh-CN", compact)`，輸出像「1.2万」 | `zh-TW` 會變「1.2萬」，`tests/status-cost.test.ts` 要跟著改 |
| `kernel/card-page.ts:34` | `<html lang="zh-CN">` | `zh-Hant-TW` |
| `protocol/rules.ts:19` | `askFirst` 預設值是簡體（删数据、停服、花钱…） | 翻成繁體。這些字會進提示詞；改 `protocol/` 也會觸發模擬 |
| 模板 `rules.json` 與文件裡的 `Asia/Shanghai`、北京时间 | 4 個模板、`docs/protocol.md:44,409`、README:138 | 改 `Asia/Taipei`（同樣 UTC+8、無日光節約，行為不變），或直接拿掉，讓它跟系統時區走（美國使用者適用） |
| 測試 fixture 的 `Asia/Shanghai` | `tests/helpers.ts`、`tests/cron.test.ts`、`tests/rules.fixture.json` 等 | 不改：測試是行為規格，使用者看不到 |
| 架構圖 | `docs/architecture.svg`、`architecture.en.svg` 裡的「飞书」「钉钉 · 企微」 | 換成 D3 選的通道 |

---

## 3. 翻譯盤點

### 3.1 規模

| 類別 | 檔案 | 漢字數 | 說明 |
|---|---:|---:|---|
| 文件（md、svg、yml、範例 json） | 約 60 | 約 4 萬 | 最大的是 `docs/protocol.md`（12,164）、`README.md`（3,561）、`SKILL.md`（3,511）、`docs/plugins.md`（2,721）、`AGENTS.md`（2,504） |
| 產品程式裡的字串 | 約 60 | 約 6,500 | `cli/` 2,372（`cli/main.ts` 一個檔就 1,942）、`plugins/` 1,215、`worker/` 1,147、`kernel/` 834、`protocol/` 664、`host/` 236。註解幾乎都已是英文 |
| 測試 | 65 | 約 5,600 | 1,077 行含中文，其中 **442 行是 assert**。改程式字串就要跟著改這些 |
| `sim/`、`scripts/` | 13 | 約 700 | 開發用，最後做 |

`README.en.md` 已經是英文；程式介面只有簡體中文，沒有任何 i18n 機制。

### 3.2 翻了會壞的字（程式會比對這些中文）

這些不是單純的顯示文字。只改一邊會出 bug，要先處理。

| 位置 | 字 | 只改一邊會怎樣 |
|---|---|---|
| `worker/contract.ts:9-10` | `FAILED = ["没跑成", …]`、`NOTHING = ["没事可做", …]`，讀 Agent 最後一則回覆的第一行 | **最危險。** 繁體是「沒跑成」（没≠沒）。提示詞翻成繁體後，Agent 會寫「沒跑成：」，程式比對不到就當成做完，該重派的活就丟了（AGENTS.md 出錯清單：「没跑成的活丢了」）。要改成繁簡都收；`docs/protocol.md:210` 把它寫成協議，第三方 `command` 腳本印的簡體也要一直收 |
| `kernel/query.ts:56`、`kernel/decide.ts:485`、`plugins/webhook/channel.ts:30`、`plugins/delivery/input.ts:25` | 「已处理」按鈕字 | webhook 通道用 `options[0] === "已处理"` 判斷是不是通知卡片，改一邊就錯 |
| `plugins/delivery/review.ts:83-84` | 用 regex 找 `## 审查要点` 標題（檔案由被交付專案的 `ops/delivery.json` 的 `review.points` 指定，`SKILL.md:109` 的範例是 `AGENTS.md`；本 repo 沒有 `ops/delivery.json`，但用交付插件的專案都吃這個標題） | 把這個標題翻成「審查要點」（包括本 repo 的 AGENTS.md），交付審查就會報「main 上没有审查要点」。要繁簡都收，或標題不翻 |
| `cli/main.ts:202-204` 與 `:373` | `try` 的提示詞要求標題寫「试跑：…」，再用 `startsWith("试跑")` 找卡片 | 兩處要同時改，否則 `agent-autoloop try` 找不到卡片 |
| `cli/try.ts:5` | `try` 用規則名「试一下」找自己的那一輪 | 翻了規則名，`try` 就看不到重試中和失敗的那一輪（Codex 審查時找到） |
| `tests/recipes.test.ts:66` | 用 regex `权限：` 讀模板 README | 模板 README 翻成「權限：」，測試就失敗 |
| `tests/example-plugins.test.ts:300-302` | 用中文標題 `## <heading>` 找 `docs/plugins.md` 裡的指令段落 | 翻標題就要一起改測試 |
| `scripts/ci-scope.sh:26-28` | 按檔名分類文件 | 新增 `README.zh-TW.md` 這類檔案時要加進 docs 分類，否則會被當成程式改動 |

另外，內核產生的卡片文字會寫進事實日誌。改字之後新卡片是繁體，舊紀錄保持簡體；照規矩不寫資料遷移。

### 3.3 依使用者看得到的程度分層

1. **每天看到的**
   - 卡片：內核自己發的告警卡片，在 `kernel/decide.ts`
   - CLI 輸出：`cli/main.ts`、`why.ts`、`explain.ts`、`spend.ts`、`mcp.ts`、`backup.ts`、`uninstall.ts`
   - 通道渲染：`plugins/feishu/channel.ts` 的 `outcomeOf`、`plugins/webhook/templates.ts` 的「打开链接」、`plugins/desktop/channel.ts`
   - 卡片網頁：`kernel/card-page.ts`
   - 錯誤訊息：`protocol/validate.ts`、`protocol/rules.ts`、`kernel/http.ts`、`host/*`
2. **Agent 讀到、決定它用什麼語言寫卡片的**
   - 提示詞：`worker/contract.ts` 的 `promptFor`、`plugins/codex/agent.ts:29`
   - `askFirst` 預設值
   - `skills/agent-autoloop/SKILL.md`：安裝時會放進 Agent 的 skills 目錄
   - 各模板的 `SKILL.md`

   提示詞維持簡體的話，Agent 寫給你的卡片多半也是簡體。要卡片變繁體，主要靠翻這一層。
3. **文件**：README、INSTALL、SECURITY、CONTRIBUTING、`docs/protocol.md`、`docs/plugins.md`、AGENTS.md、模板 README、架構圖、issue 與 PR 範本。
4. **只有開發者看到的**：測試、`sim/`、`scripts/`。只改到測試能過的程度。

### 3.4 術語表（初稿，D7 要定）

產品自己的詞：

| 簡體原文 | 建議 | 備註 |
|---|---|---|
| 中台 | 中控台／調度中心／保留「中台」 | 「中台」在台灣聽得懂，但是大陸企業用語；程式裡叫 `hub` |
| 接单程序 | 接單程式 | |
| 回执 | 回條 | 「回報」已經拿去翻通道的「报告」，避免撞詞 |
| 一轮、事项、卡片、规则、来源、本人、资料 | 一輪、事項、卡片、規則、來源、本人、資料 | 直接轉字 |
| 通道 | 通道／通知管道 | |
| 拍板 | 拍板／定奪 | |
| 复查 | 複查 | |
| 跳数熔断 | 跳數熔斷 | |

一般用語：

| 簡體原文 | 建議 | 備註 |
|---|---|---|
| 文件／文档 | 檔案／文件 | **有歧義**：大陸「文件」是 file，台灣「文件」是 document，要看上下文 |
| 程序／进程 | 程式／行程（OS process） | **有歧義**；「行程」對一般人像旅遊行程，大白話可能寫「程式」比較好 |
| 默认、配置、插件、模板、脚本 | 預設、設定、外掛（或「插件」）、範本、腳本 | |
| 命令行、终端、链接、密钥、凭据 | 命令列、終端機、連結、金鑰、憑證 | |
| 并发、队列、回调、轮询 | 同時執行（並行）、佇列、回呼、輪詢 | |
| 内存、磁盘、数据库、事务、日志 | 記憶體、磁碟、資料庫、交易、日誌 | |
| 用户、账号、登录、卸载 | 使用者、帳號、登入、解除安裝 | |
| 支持、运行、调用、接口、字段、参数、兼容 | 支援、執行、呼叫、介面（API）、欄位、參數、相容 | |
| 软件、服务器、网络、信息、质量、屏幕、后台、实时 | 軟體、伺服器、網路、訊息、品質、螢幕、背景、即時 | |

### 3.5 建議做法（D2）

- **轉換用腳本，不手改。** 用 OpenCC 的 `cn → twp`（台灣用詞）。在這個 Node 專案裡可以加 `opencc-js` 當 devDependency，不違反「不寫 dependencies」。再加一份專案詞彙表，覆寫 §3.4 的產品用語和有歧義的詞。轉換範圍用白名單：使用者可見字串和文件。協議字（§3.2）、識別字、程式碼區塊裡的指令不轉。
- **同步上游的流程**：merge 上游 → 字串檔的衝突一律取上游版本 → 重跑轉換腳本 → 跑測試。這樣衝突是機械式的，不用每次手動合字。
- **§3.2 的繁簡雙收，是小而無害的程式改動，可以推成上游 PR。** AGENTS.md 寫「外部 PR 尽量合」，上游收了以後 fork 的差異就少一塊。
- 如果 D1 選了中英雙語，再考慮向上游提 i18n。範圍包括內核產生的文字，語系要從外殼傳進內核才能保持確定性，改動大，上游也不一定接受。

---

## 4. 建議的批次順序

每一批都按 AGENTS.md：先寫測試，`npm test`、`npm run typecheck`、`npm run format:check` 都要過。

1. **批次 0：fork 基礎**（§1）。不做的話其他改動裝不到使用者手上。
2. **批次 1：協議字繁簡雙收**（§3.2）。先寫失敗測試，例如「第一行寫『沒跑成：』要重派」。可以推上游。
3. **批次 2：新通道**（§2.1，依 D3）。新增插件加上 webhook 模板；文件和架構圖一起改。
4. **批次 3：翻譯**（§3，依 D1、D2、D7）。依序做轉換腳本與詞彙表、程式字串加測試、提示詞與 SKILL、文件。
5. **批次 4：場景模板與 README 的 Agent 表**（§2.2、§2.4，依 D5）。

---

## 5. 多語系設計（2026-11-06 確認）

目標：介面和給 Agent 的提示詞都支援 `zh-CN`、`zh-TW`、`en`。介面包括 CLI 輸出、卡片、錯誤訊息、卡片網頁、通道上的字。文件也做三種語言。

### 5.1 語言從哪來

- `rules.json` 新增 `"language"`，可填 `"zh-CN"`、`"zh-TW"` 或 `"en"`，跟 `timezone` 並列。
- 不寫就是 `zh-CN`，跟上游行為一樣；現有 442 行中文斷言不用改。
- 為什麼放 `rules.json`：內核產生的卡片文字會寫進事實日誌，語言必須來自日誌裡有的東西，內核才能保持確定性。規則版本本來就記在日誌裡。
- 新安裝時，`agent-autoloop init` 依系統 `LANG` 把 `language` 寫進新的 `rules.json`：
  - `zh_TW`、`zh_HK` → `zh-TW`
  - `zh_CN`、`zh_SG` → `zh-CN`
  - 其他 → `en`
  - 已經裝好的不動。
- 還沒有 `rules.json` 時，`install.sh` 和 `init` 自己的輸出看 `LANG`。

### 5.2 怎麼傳到各處

都是協議新增的欄位，老插件忽略就好，照協議的相容規則算第二位版本。

| 誰 | 從哪拿語言 | 老版本怎樣 |
|---|---|---|
| 內核 | 當下的規則。卡片文字和錯誤訊息用它 | — |
| CLI | `/v1/state` 多一個 `language`；連不到中控台的指令（`check`、`init`）讀本機 `rules.json` | 老中控台沒這欄，就用 `zh-CN` |
| 接單程式 | Job 多一個 `language`，用它組提示詞，並要 Agent 用這個語言寫結論和卡片 | 老接單程式照舊給簡體提示詞 |
| 通道 | `GET /v1/cards/next` 的卡片多一個 `language`；通道自己的字（「你選了…」「記下了」）照它 | 老通道照舊顯示簡體 |

內核還是只收、只分、只派、只記，不讀環境。

### 5.3 程式字串怎麼抽

- 新目錄 `words/`，`words(language)` 回傳一個 tagged template：``t`连续 ${n} 次没跑成` ``。
- 原文（簡體）就是 key，所以：
  - 程式碼裡照樣看得到原文，跟上游的差別只多一個 `t`，合併衝突是機械式的。
  - 找不到翻譯就顯示原文，不會壞。
- `words/zh-TW.ts`：由腳本把原文用 OpenCC 的 `cn → twp` 加上 §3.4 的詞彙表產生，不手改；上游改了字就重跑。`opencc-js` 放 devDependencies，不違反「不寫 dependencies」。
- `words/en.ts`：英文翻譯，手工維護，或交給 Agent 翻再驗收。
- 測試：掃出所有 ``t`…` `` 的原文，每一條都要有英文；`zh-TW` 要跟腳本的產出一致。上游新增字串時測試就會失敗，提醒補翻譯。
- §3.2 剩下的兩項在這一批改：
  - webhook 通道改用 `kind === "notice"` 判斷通知卡片，不再比對按鈕上的「已处理」。
  - `try` 的提示詞和找卡片的比對用同一條字串。

### 5.4 文件

- 檔名：`README.md` 是簡體（上游），`README.en.md` 是英文（上游已有），新增 `README.zh-TW.md`。其他文件同樣加 `.zh-TW.md`、`.en.md`。
- 繁中文件用同一個轉換腳本從簡體產生，上游改了就重跑。
- 英文文件：INSTALL、SKILL、SECURITY、CONTRIBUTING、模板 README、protocol、plugins 交給外部 Agent 翻，我驗收。
- `AGENTS.md` 不翻：它是給改這個 repo 的 Agent 看的，跟上游的開發流程綁在一起。
- 安裝進 Agent 的 SKILL 依 `language` 選對應的版本。
- 架構圖三種語言各一份，順便加上 Telegram。
- `scripts/ci-scope.sh` 把新文件歸到 docs。

### 5.5 工作量與風險

- 程式：約 60 個檔、600 行字串要加 `t`。內核也要改，所以 CI 會跑 2 萬步模擬；AGENTS.md 也要求第一個改內核的 PR 合併後跑一次每日檢查。
- 測試：現有中文斷言不用改，因為預設還是 `zh-CN`；另外新增切換語言的測試。
- 同步上游：每次合併，有改到的字串行會有小衝突；上游新增的字要補英文。
- 這層多語系也可以推給上游。上游接受的話，fork 跟上游的差異會小很多；不接受也不影響我們。

---

## 6. 記下、暫不修

照 AGENTS.md：幾個罕見條件湊在一起才發生的先記下來，有人碰到再修。

| 來源 | 情況 | 為什麼先不修 |
|---|---|---|
| Codex 審查批次 0–2 | Telegram 點擊轉給中控台失敗時（例如中控台暫時連不上），這次點擊不會自動補送；使用者會看到「沒記上」，要再點一次。若中控台超過 Telegram 的回覆期限才失敗，連這句提示都看不到 | 飛書通道也是一樣：點擊轉送失敗只記日誌。通道通常和中控台在同一個行程裡，連不上的機會很低 |
| Codex 審查批次 0–2 | Telegram 回 429 時沒照 `retry_after` 等，靠中控台原本的退避重試 | 不會把失敗當成功；個人用量碰不到頻率上限 |

### 批次 3 跟 §5 設計不同的地方

| 設計 | 實際 | 原因 |
|---|---|---|
| 安裝進 Agent 的 SKILL 依語言選版本 | Agent 讀的 `SKILL.md` 維持簡體；給人看的另有 `SKILL.zh-TW.md`、`SKILL.en.md` | `init` 把整個 skill 目錄用 symlink 連過去，沒辦法依語言挑檔案；Agent 看得懂簡體，提示詞會要它用規則的語言寫結論和卡片 |
| 安裝時用 `init --language` | 用環境變數 `AGENT_AUTOLOOP_LANGUAGE` 傳 | Codex 審查 3a 找到：安裝腳本來自 `main`、程式是較舊的 Release 時，舊版 `init` 會拒絕不認識的參數 |
| 內建插件跟核心共用翻譯檔 | 每個內建插件自己帶 `en.ts`、`zh-TW.ts` | 內核引用的翻譯檔不該出現產品名字；插件也能自成一包 |

### 批次 3 刻意沒翻的

| 什麼 | 為什麼 |
|---|---|
| `plugins/delivery/action.ts`、`project.ts` | 註解約定它們只依賴 Node 和同一個資料夾，給 Ship Action 用；它們的字多半只出現在 GitHub Actions 的紀錄 |
| `examples/recipes/` 裡的腳本（`collect.ts`、`handoff.ts`、`check.ts`） | 範例，使用者會照自己的需要改；其中有些字會被比對（例如飛書摘要找「请恢复飞书资料读取」這張卡片） |
| 服務設定範本（systemd unit、launchd plist） | 是設定檔，不是介面；跟著語言變的話，換語言就會被當成服務設定改了 |
| `AGENTS.md`、`.github/` 的 Issue 和 PR 範本、場景模板的 `SKILL.md` | 給改這個 repo 或執行任務的 Agent 看的，跟上游流程綁在一起 |
| 存下來的「誰做的」（`by: "本人"`、`"链接"`） | 是資料不是介面，改了會讓新舊紀錄不一致 |

### 批次 3 記下、暫不修

| 情況 | 為什麼先不修 |
|---|---|
| 改了簡體文件卻沒重產繁中版，純文件的 PR 不會被擋 | 要讓測試讀文件，就得把所有文件改成會跑測試的分流；合進 `main` 後的快速測試也不讀文件。改文件時照 AGENTS.md 跑 `node scripts/docs.ts` |
| 英文文件要手動跟上簡體版 | 沒有可靠的自動翻譯；上游改了文件就要補 |
| 中控台在跑的時候改了 `language`，已經在跑的那一輪照舊用原來的語言 | 新的一輪就會用新語言 |
| HTTP 層的錯誤訊息語言是每個請求進來時設定的；剛改完 `language` 的那一刻，同時進來的請求可能拿到另一種語言的錯誤（Codex 審查 3b 找到） | 只影響錯誤訊息的語言，不影響判斷、事實或權限 |
