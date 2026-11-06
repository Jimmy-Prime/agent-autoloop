// Vendor message formats: links are listed in protocol.md so the fields can be checked against their owning APIs.
import { wordsIn, type Language } from "../../words/words.ts";
import en from "./en.ts";
import zhTW from "./zh-TW.ts";

function wecomMarkdown(text: string, language?: Language) {
  const t = wordsIn({ en, "zh-TW": zhTW })(language);
  return text.replace(/https?:\/\/[^\s；，。]+/g, (url, offset, source) =>
    source.slice(Math.max(0, offset - 2), offset) === "](" ? url : t`[打开链接](${url})`,
  );
}

export function payload(platform: string, text: string, language?: Language): object {
  const t = wordsIn({ en, "zh-TW": zhTW })(language);
  if (platform === "discord" && [...text].length > 2000) throw new Error(t`Discord 消息超过 2000 个字，请缩短卡片`);
  const markdown = platform === "wecom" ? wecomMarkdown(text, language) : "";
  if (platform === "wecom" && Buffer.byteLength(markdown) > 2048)
    throw new Error(t`企微消息超过 2048 字节，请缩短卡片`);
  switch (platform) {
    case "dingtalk":
      return { msgtype: "text", text: { content: text }, at: { isAtAll: false } };
    case "wecom":
      return { msgtype: "markdown", markdown: { content: markdown } };
    case "slack":
      return { text, mrkdwn: false, unfurl_links: false, unfurl_media: false };
    case "discord":
      return { content: text, allowed_mentions: { parse: [] } };
    default:
      throw new Error(t`没有这个 Webhook 模板：${platform}`);
  }
}

export async function accepted(platform: string, response: Response, language?: Language) {
  const t = wordsIn({ en, "zh-TW": zhTW })(language);
  if (!response.ok) throw new Error(t`返回 ${response.status}`);
  if (platform === "dingtalk" || platform === "wecom") {
    const result = await response.json();
    if (result.errcode !== 0) throw new Error(t`发送失败：${result.errmsg ?? result.errcode}`);
  } else if (platform === "slack" && (await response.text()).trim() !== "ok")
    throw new Error(t`Slack 没有确认收到消息`);
}
