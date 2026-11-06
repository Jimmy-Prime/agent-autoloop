# 安裝說明（寫給 Agent）

[简体中文](INSTALL.md) | **繁體中文** | [English](INSTALL.en.md)

> 這份由 `scripts/docs.ts` 從簡體中文版自動轉換，改內容請改簡體中文版。

使用者請你裝好 Agent 自動化中控台。先安裝，再走一遍提問和繼續處理；能自己做的直接做。

## 安裝

支援 macOS、Linux。Windows 還不支援：上游正在開發，進度見上游的 [#17](https://github.com/KKKKhazix/agent-autoloop/issues/17)，現在還不能直接裝。在 WSL2 裡按 Linux 安裝能跑通（有使用者實測過），要知道這幾件事：系統服務要發行版開著 systemd（`/etc/wsl.conf` 裡 `systemd=true`，沒開就加 `--no-service`，自己執行 `agent-autoloop up`），預設也不會在沒人登入時啟動，要的話執行 `loginctl enable-linger`；桌面通知到不了 Windows 桌面，用 `agent-autoloop status` 看卡片，或者接飛書等通道；用 `command` 接的 Agent 不上報用量，Token 和費用顯示“沒上報”；WSL2 本身要佔 1GB 左右記憶體。

需要 Node.js 24 或更新、Git、curl，以及一個已經登入的命令列 Agent。

先檢查 `node --version`。Homebrew 的 `node@24` 預設不進 PATH，裝好後還要執行 `export PATH="$(brew --prefix node@24)/bin:$PATH"`；需要長期生效時再寫入使用者的 shell 設定。不要替使用者登入，也不要讀取或複製登入憑證。

本倉庫已公開，安裝腳本和程式碼都可匿名下載，不需要 GitHub 帳號、登入或 GitHub CLI（`gh`）。下面的命令安裝並啟用登入後常駐服務：

```bash
curl -fsSL https://raw.githubusercontent.com/Jimmy-Prime/agent-autoloop/main/install.sh | sh
```

GitHub Issue 輪詢和 PR 交付等功能另需已登入的 `gh`，按對應場景說明設定；執行 Agent 也仍需該 Agent 自己的登入或授權。

安裝和 `agent-autoloop update` 都裝最新的 Release，那是通過了全部檢查的版本，`main` 上還沒釋出的改動要等下一個 Release。已經裝了上游 KKKKhazix/agent-autoloop 正式版的，直接執行上面的安裝命令，就會改成跟著這個 fork 的 Release，規則、金鑰和記錄都保留。

使用者指定本地倉庫時，用該目錄的安裝腳本，並把 `AGENT_AUTOLOOP_REPO` 設成它的絕對路徑。不要下載 GitHub 的舊腳本，也不要用未提交的檔案冒充已安裝版本；這時安裝器克隆的是本地倉庫的 HEAD，`update` 也跟著那個倉庫走，不看 Release。已經裝過時這個變數不起作用，還跟著原來的來源走；要換來源，先執行 `agent-autoloop uninstall` 再裝。

下面以 `/path/to/agent-autoloop` 為例，使用已經登入的 Codex：

```bash
AGENT_AUTOLOOP_REPO=/path/to/agent-autoloop sh /path/to/agent-autoloop/install.sh --agent codex
```

`--agent claude` 選擇 Claude Code；只有其他 CLI 時加 `--command 'hermes chat -Q -q {prompt}'`。不指定時會檢測本機安裝的 Agent，第一種作為試跑對象。

程式裝進 `~/.agent-autoloop/app`，設定和記錄留在 `~/.agent-autoloop`。預設開啟桌面通知；沒有圖形會話時安靜跳過，問題仍能用 `agent-autoloop status` 檢視。命令優先放在 PATH 中的 `~/.local/bin`，否則選 PATH 裡第一個可寫目錄，不用 sudo、不覆蓋其他程式；沒有位置時使用安裝器印出的完整路徑。

安裝器和中控台啟動時都會把資料目錄設為 `0700`，包括已有目錄，阻止其他系統使用者讀取資料庫、事件和執行輸出。升級後同步重啟中控台與接單程式；新版 `status` 使用中控台提供的費用匯總。

升級時若投影格式有變化，會自動從舊日誌逐條重建，歷史多時首次啟動需要等待；之後正常啟動直接複用投影。原日誌和已有卡片連結保留，不需要手動遷移。

## 臨時 HOME、CI 或沒有服務管理器

使用臨時 HOME 時不要裝系統服務，不改真實使用者的 shell 設定和 Agent 設定。保留呼叫者給定的 `AGENT_AUTOLOOP_HOME`；用真實 `CODEX_HOME` 只為了沿用已經完成的 Codex 登入。

在臨時環境中選一個空閒埠，執行本地安裝腳本，隨後啟動中控台：

```bash
port=$(node -e 'const s=require("node:net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')
AGENT_AUTOLOOP_REPO=/path/to/agent-autoloop sh /path/to/agent-autoloop/install.sh --agent codex --no-service --port "$port"
agent-autoloop up
```

`up` 會一直執行。在 Agent 的命令工具裡保留它返回的執行中會話，再用另一條命令完成驗證；不要用 `nohup … &` 代替，命令工具可能在退出時清理後台行程。看到監聽地址後再執行驗證命令；啟動失敗就先處理該會話裡的錯誤。

PATH 沒有命令時，把 `agent-autoloop` 換成安裝器印出的完整路徑。臨時測試使用假的 `osascript`、`notify-send`，不要傳送真實訊息；不要給已線上的飛書應用再開監聽。

## 驗證

先檢視安裝和連線情況，再用真實 Agent 跑完整問答：

```bash
agent-autoloop --version
agent-autoloop doctor
agent-autoloop try
```

`try` 會使用使用者的模型額度。在非互動終端機，它印出問題和 `agent-autoloop answer` 命令後退出；這是正常等待，不是失敗。把問題轉給使用者，按他的選擇回答，再執行 `agent-autoloop status`，看到“試跑通過”才算接通。僅為安裝驗證時，可以選擇第二項綠色完成試跑。

Claude 要委託 Codex 處理網頁時，可用[瀏覽器交接範本](examples/recipes/browser-handoff/README.zh-TW.md)，先設定現成入口，再驗收首次呼叫與原會話續辦。範本不安裝瀏覽器驅動、不自動放寬 Claude 命令權限。

任務還需要網頁操作時，另按[瀏覽器接入](docs/plugins.zh-TW.md#瀏覽器接入)用同一後台啟動方式核實實際頁面和會話接續。`try` 只證明問答流程；中控台不自動提供瀏覽器連線或修改 Agent 的工具設定。需要本人恢復連線、登入或驗證時，保留待驗收項並交 `ask`，不要反覆重跑已完成的業務。

沒有安裝系統服務時，`doctor` 會顯示服務未執行；檢查中控台、Agent 和桌面通道是否線上即可，不要為了消除這條提示安裝真實服務。

## 寫第一條規則

安裝驗證完成後，按使用者希望自動處理的事從 [README 的場景範本](README.zh-TW.md#拿來即用的場景範本)選一個，再照[設定手冊](skills/agent-autoloop/SKILL.zh-TW.md)寫規則；使用者還沒指定用途時再問。用 `agent-autoloop check` 檢查；改動幾秒內生效。

國內業務可從反饋處理、網站巡檢、飛書週報與業務摘要三套範本開始。它們預設飛書本人私聊；替換佔位符後，設定和業務資料留在私有目錄，不提交到倉庫。範本不替使用者新建憑證或擴大飛書權限。

桌面通知只在這台電腦上顯示。需要別的通道時，先確認接收位置，再按設定手冊接入。不要直接測試發信或發群訊息。`access` 的含義見[外掛說明](docs/plugins.zh-TW.md#access-實際能做什麼)，不要替使用者擴大權限。

## 解除安裝

解除安裝程式，預設保留規則、金鑰和記錄：

```bash
agent-autoloop uninstall
```

終端機裡確認後才執行；非互動執行時加 `--yes` 跳過確認，資料同樣保留。它只停自己的服務和行程、刪除指向自身的命令及 Skill 連結，以及安裝目錄裡的 `app`。其他同名檔案不動；資料目錄不刪除。

臨時安裝驗證完，用 `agent-autoloop uninstall --yes` 停掉本次行程，再清掉自己建立的臨時目錄。不要解除安裝使用者已經在用的中控台。

## 文件

- [設定手冊](skills/agent-autoloop/SKILL.zh-TW.md)：接事件外掛、通道、多台電腦和交付流水線。
- [協議](docs/protocol.zh-TW.md)：HTTP、回條、事實日誌和故障恢復。
- [外掛](docs/plugins.zh-TW.md)：三個可執行的最小例子。
- [安全邊界](SECURITY.zh-TW.md)：金鑰、執行權限和交付審查。

開發檢查用 `npm run test:quick`（改了 `kernel/`、`protocol/`、`sim/` 時用 `npm test`）、`npm run typecheck`、`npm run format:check`，完整故障檢查和效能實測用 `npm run test:nightly`。備份和恢復見[設定手冊](skills/agent-autoloop/SKILL.zh-TW.md#日誌與恢復)。`master.key` 壞了中控台會拒絕啟動：從備份恢復；沒有備份就刪掉它，重啟會生成新的，已發出的卡片連結和正在跑的輪次會失效。
