// Telegram, through the Bot API: sending is a plain HTTPS request and clicks come back by long polling getUpdates, so this
// machine needs no public address. A bot answers only one getUpdates at a time, and none while it has a webhook set, so
// run this in one place. Telegram takes no idempotency key: a send whose report to the hub is lost can be sent again.
//   "channels": { "telegram": { "key": "…", "token": "123456:ABC…", "chat": "123456789" } } in config.json
//   "channels": { "telegram": { "name": "Telegram", "answerers": ["123456789"] } } in rules.json: who may answer.
import type { Card, ChannelContext } from "../../host/channels.ts";

// https://core.telegram.org/bots/api#sendmessage: 1-4096 characters of text.
const MOST = 4096;
const ANSWER_SHOWN = 200;

function outcomeOf(card: Card) {
  const chosen = card.choice === null ? card.answer : card.options[card.choice];
  if (card.state === "decided") return `你选了「${chosen}」，已记录，等待处理。`;
  if (card.state === "done") return `你选了「${chosen}」。${card.result ? `已执行：${card.result}` : "已执行。"}`;
  if (card.state === "closed" && card.kind === "ask") return `不用决定了：${card.result ?? ""}`;
  return card.state === "closed" && card.result ? card.result : null;
}

/** One card, as it looks now, in plain text so nothing anyone wrote is read as markup; buttons only while it's open. */
export function render(card: Card) {
  const open = card.state === "open";
  const ask = card.kind === "ask";
  // A button shows one line of its label; the full options are in the message itself.
  const choices =
    open && ask
      ? card.options.map((option, index) => `${index + 1}. ${option}${index === card.recommend ? "（推荐）" : ""}`)
      : [];
  const note = card.kind === "notice" && card.answer ? `处理说明：${card.answer}` : "";
  const text = [card.title, card.text, choices.join("\n"), outcomeOf(card) ?? "", note].filter(Boolean).join("\n\n");
  if (text.length > MOST) throw new Error(`Telegram 消息超过 ${MOST} 个字，请缩短卡片`);
  const buttons = open
    ? card.options.map((option, index) => [
        { text: ask ? `${index + 1}. ${option}` : option, callback_data: `${card.id}:${index}` },
      ])
    : [];
  return { text, buttons };
}

/** The message a card was sent as: its chat, which for a group starts with a minus, and its number there. */
function messageOf(ref: string) {
  const at = ref.lastIndexOf(":");
  return { chat_id: ref.slice(0, at), message_id: Number(ref.slice(at + 1)) };
}

export default async function telegram({ hub, options, log, signal }: ChannelContext) {
  const { token, chat } = options;
  if (typeof token !== "string" || !token) throw new Error("Telegram 通道要在 config.json 写 bot 的 token");
  if ((typeof chat !== "string" && typeof chat !== "number") || chat === "") {
    throw new Error("Telegram 通道要在 config.json 写 chat：你和 bot 私聊的 chat id");
  }
  const api = String(options.api ?? "https://api.telegram.org");
  const pause = () => new Promise((resolve) => setTimeout(resolve, 10_000));

  /** A Bot API call. What goes wrong is said by method and Telegram's words, never with the address that holds the token. */
  async function call(method: string, body: object, seconds = 30) {
    let response: Response;
    try {
      response = await fetch(`${api}/bot${token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.any([signal, AbortSignal.timeout(seconds * 1000)]),
      });
    } catch (error) {
      throw new Error(`Telegram ${method} 连不上：${error instanceof Error ? error.name : "error"}`);
    }
    const out = await response.json().catch(() => null);
    if (!out?.ok) throw new Error(`Telegram ${method}：${out?.description ?? `返回 ${response.status}`}`);
    return out.result;
  }

  async function deliver() {
    while (!signal.aborted) {
      let card: Card | null;
      try {
        ({ card } = await hub.nextCard(50));
      } catch (error) {
        log(`couldn't reach the hub: ${error}`);
        await pause();
        continue;
      }
      if (!card) continue;
      try {
        const { text, buttons } = render(card);
        const quiet = { link_preview_options: { is_disabled: true } };
        let ref = card.ref;
        if (ref) {
          try {
            await call("editMessageText", {
              ...messageOf(ref),
              text,
              reply_markup: { inline_keyboard: buttons },
              ...quiet,
            });
          } catch (error) {
            // Telegram refuses an edit that changes nothing; the message already looks like this.
            if (!String(error).includes("message is not modified")) throw error;
          }
        } else {
          const markup = buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {};
          const sent = await call("sendMessage", { chat_id: chat, text, ...markup, ...quiet });
          ref = `${sent.chat.id}:${sent.message_id}`;
        }
        await hub.delivered(card.id, card.version, ref);
      } catch (error) {
        log(`card ${card.id} not sent: ${error}`);
        await hub.failed(card.id, card.version, String(error)).catch(() => {});
      }
    }
  }

  /** Only a click on the message that was sent, by someone the rules let answer, counts; the hub checks both. */
  async function clicked(query: any) {
    const found = /^(\d+):(\d+)$/.exec(String(query.data ?? ""));
    const message = query.message;
    let said = "";
    if (found && message?.chat?.id !== undefined && message.message_id !== undefined) {
      const card = Number(found[1]);
      const by = String(query.from?.id ?? "");
      try {
        const answer = await hub.answer(card, {
          choice: Number(found[2]),
          by,
          ref: `${message.chat.id}:${message.message_id}`,
        });
        said = answer.changed ? "记下了" : "这张已经定过了";
        log(`card ${card}: answered by ${by}, ${answer.changed ? "counted" : "already settled"}`);
      } catch (error) {
        said = `没记上：${error instanceof Error ? error.message : error}`.slice(0, ANSWER_SHOWN);
        log(`card ${card}: click not handled: ${error}`);
      }
    }
    // Unanswered, the button keeps spinning on their phone.
    await call("answerCallbackQuery", { callback_query_id: query.id, ...(said && { text: said }) }).catch((error) =>
      log(`click not acknowledged: ${error}`),
    );
  }

  async function listen() {
    // Asking from past the last update heard confirms it; one not confirmed comes again, and the hub counts an answer once.
    let offset = 0;
    while (!signal.aborted) {
      let updates: any[];
      try {
        updates = await call("getUpdates", { offset, timeout: 50, allowed_updates: ["callback_query"] }, 80);
      } catch (error) {
        if (signal.aborted) return;
        log(`couldn't hear clicks: ${error}; trying again in 10 seconds`);
        await pause();
        continue;
      }
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        if (update.callback_query) await clicked(update.callback_query);
      }
    }
  }

  await Promise.all([deliver(), listen()]);
}
