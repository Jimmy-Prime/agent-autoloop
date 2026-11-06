// English, kept by hand: every t`…` this catalog is for has a line here.
export default {
  "Codex 没有完成并留下实际结果": "Codex did not finish and leave an actual result",
  "Codex 没有登录或用不了：运行 codex login（{0}）": "Codex is not signed in or is unavailable: run codex login ({0})",
  "Codex 没跑完这一轮": "Codex did not finish this round",
  "本轮通过后台 codex exec 运行，不要假定桌面应用的浏览器连接已带到本轮。":
    "This round runs through codex exec in the background. Do not assume the desktop app's browser connection is available in this round. ",
  "沿用该入口的会话，只交网页步骤，业务处理和中台回执仍由本轮负责；没有可用入口或需要本人恢复连接时，按待你处理的约定交回。\n\n":
    "Continue that entry point's session and hand it only the web steps. This round remains responsible for the work and the receipt to the hub. If no entry point is available or the owner needs to restore the connection, return control using the NEEDS YOU: convention.\n\n",
  "网页操作使用本轮实际可用的浏览器工具，或使用规则或 Skill 中已明确配置的浏览器入口。":
    "For web actions, use browser tools actually available in this round, or a browser entry point explicitly configured in the rule or Skill. ",
} as Record<string, string>;
