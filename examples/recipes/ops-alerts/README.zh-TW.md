# 跟進線上報錯

[简体中文](README.md) | **繁體中文** | [English](README.en.md)

> 這份由 `scripts/docs.ts` 從簡體中文版自動轉換，改內容請改簡體中文版。

## 解決什麼
收到報錯後對照原生代碼查原因，需要重啟就發卡片問你；示例重啟腳本只印出文字。

## 怎麼啟用
把 `SKILL.md` 複製到 `~/.codex/skills/ops-alerts/`；Claude Code 用 `~/.claude/skills/ops-alerts/`，把 `restart.sh` 放到服務程式碼目錄。
把 `rules.json` 並進 `~/.agent-autoloop/rules.json`，包括 `askFirst`；執行 `agent-autoloop check`，再用 `agent-autoloop key new source shop` 取得 `$SHOP_KEY`。
報錯系統用自己的來源金鑰發事件：
```bash
curl -fsS http://127.0.0.1:3350/v1/events -H "Authorization: Bearer $SHOP_KEY" -H 'Content-Type: application/json' -d '{"id":"checkout-20261104-0310","type":"alert.error","subject":"checkout","summary":"結賬報錯","detail":"TypeError: price is undefined at src/cart.ts:42"}'
```

## 要改哪幾處
- 兩處 `worker`、`cwd` 換成接單電腦和程式碼目錄；`use` 選 `codex` 或 `claude`。
- 權限：`read`。只讀程式碼和事件附帶的呼叫棧，不需要聯網；Claude 的 plan 是工具審批規則，不是系統沙箱，見[權限說明](../../../docs/plugins.zh-TW.md#access-實際能做什麼)。
- `restart.sh` 換成固定的重啟及健康檢查命令；跨電腦傳送前先按[設定手冊](../../../skills/agent-autoloop/SKILL.zh-TW.md#放到伺服器加電腦)設定地址。
- 不給 `shop-fix` 建外部來源金鑰。重啟腳本不受 `access` 限制，是否已獲同意由 Skill 核對，不能當成強制審批。
