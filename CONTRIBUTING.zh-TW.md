# 參與貢獻

[简体中文](CONTRIBUTING.md) | **繁體中文** | [English](CONTRIBUTING.en.md)

> 這份由 `scripts/docs.ts` 從簡體中文版自動轉換，改內容請改簡體中文版。

歡迎提交可復現的問題、文件修正、外掛和通用能力改進，中文或英文都可以。

## 去哪裡交流

- [Issues](https://github.com/Jimmy-Prime/agent-autoloop/issues/new/choose)：可以復現的故障和有明確場景的功能建議。能做的由維護者修復，修復提交會署上報告者。
- [使用問答](https://github.com/Jimmy-Prime/agent-autoloop/discussions/categories/q-a)：安裝、規則、Agent 和通道設定。
- [想法交流](https://github.com/Jimmy-Prime/agent-autoloop/discussions/categories/ideas)：討論還沒形成開發任務的想法。
- [實踐分享](https://github.com/Jimmy-Prime/agent-autoloop/discussions/categories/show-and-tell)：分享外掛、場景模板和使用經驗。
- 安全問題按 [安全說明](SECURITY.zh-TW.md) 聯絡維護者，不在公開討論中披露利用細節。

## 貢獻範圍

新 Agent、事件外掛和通道接在外掛層；完整業務流程可以做成場景模板。先看 [外掛開發說明](docs/plugins.zh-TW.md) 和 [現有場景](README.zh-TW.md#拿來即用的場景模板)，避免重複實現。

核心保持零執行時依賴，不連線外部產品。總覽頁、工作流畫布和其他介面屬於獨立客戶端，不放進這個倉庫。改協議或核心流程前，先說明具體場景和相容影響；維護約定見 [AGENTS.md](AGENTS.md)，協議見 [docs/protocol.md](docs/protocol.zh-TW.md)。

## 提交改動

1. 從最新的 `main` 建立分支；外部貢獻者使用 Fork。本倉庫裡的分支只能以 `claude/`、`codex/` 或 `dependabot/` 開頭，tag 只用於釋出（`v1.2.3`）。Agent 在獨立工作樹裡開發，主目錄保留在 `main`。
2. 使用 Node.js 24 或更新版本，執行 `npm ci`。一次 PR 解決一個問題，同步更新受影響的中英文說明、示例和設定。
3. 修 bug 先寫能復現它的失敗測試，測試檔案開頭說明防止什麼失敗。純文件、模板或小範圍可逆改動，不補照著實現抄的測試。
4. 提交前執行 `npm run test:quick`、`npm run typecheck`、`npm run format:check`。改了 `kernel/`、`protocol/`、`sim/` 時用 `npm test`，它多跑完整模擬和窮舉。涉及日誌、到期表或並行時，再執行 `npm run test:nightly`。CI 在 Linux 和 macOS 上檢查，並用已提交的程式碼執行安裝到解除安裝的冒煙驗證；只改文件時跳過這些檢查，PR 上只有改了 `kernel/`、`protocol/` 或模擬本身才跑一段 2 萬步的短模擬，合併後再跑一遍快速測試和安裝冒煙；完整模擬、窮舉、強殺和變異每天定時跑一次，同時用最新的 Node 跑快速測試。
5. 向 `main` 提交 PR，說明問題、改後的行為、驗證結果和相容影響。未完成的工作使用草稿；合併前確認當前提交的兩項系統檢查通過。請勾選“Allow edits by maintainers”：要調整的地方維護者通常直接在你的分支上改好再合併。Fork 的 CI 跑在 GitHub 的機器上，自動執行；GitHub 新註冊帳號的首次 PR 要維護者批准後才執行。

測試使用臨時 `AGENT_AUTOLOOP_HOME`、隨機埠、本地假 HTTP 和假通知命令。不要連線真實業務資料庫、傳送訊息，或給已線上的飛書應用再開事件監聽。真實交付指令碼會建立和刪除指定測試倉庫，只在使用者明確要求時執行。

不要提交金鑰、帶許可權的卡片連結、完整設定、資料庫、執行輸出或同事資料。問題中的日誌和截圖也要先脫敏。程式碼按 [MIT 許可證](LICENSE) 提交。

使用者裝的是最新的 Release，不是 `main`：合進 `main` 的改動等下一個 Release 才到使用者手上，安裝和更新方式見 [INSTALL.md](INSTALL.zh-TW.md)，版本號的規則見[協議](docs/protocol.zh-TW.md#版本與相容)；目前沒有長期支援分支。倉庫設定中的自動合併保持關閉，交付外掛按 [交付協議](docs/protocol.zh-TW.md#交付外掛) 完成審查、檢查和合並。
