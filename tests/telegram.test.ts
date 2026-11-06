// The Telegram channel, against a stand-in Bot API on this machine: no real message is sent. Failure cases: what someone
// wrote is sent as markup; a card's options don't show while it's open, or its buttons stay after it's settled; an update
// sends a new message rather than changing the one sent; a send Telegram refuses isn't reported, or an update Telegram
// calls no change is; a card longer than Telegram takes is cut instead of reported; a click that isn't on one of its cards
// reaches the hub, or one that is doesn't say who clicked and on which message; a click is left spinning, or the same
// click is heard again because the updates weren't confirmed; the bot's token shows up in what's logged or reported.
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { after, test } from "node:test";
import telegram, { render } from "../plugins/telegram/channel.ts";
import type { Card } from "../host/channels.ts";

const TOKEN = "123:secret-token";
const base: Card = {
  id: 5,
  version: 1,
  ref: null,
  kind: "ask",
  state: "open",
  title: "要不要删",
  text: "占了 <b>10 GB</b>",
  options: ["删", "留着"],
  recommend: 1,
  choice: null,
  answer: null,
  result: null,
  link: null,
};

test("a card shows its options while it's open, and what became of it after", () => {
  const open = render(base);
  assert.match(open.text, /要不要删\n\n占了 <b>10 GB<\/b>\n\n1\. 删\n2\. 留着（推荐）/);
  assert.deepEqual(open.buttons, [
    [{ text: "1. 删", callback_data: "5:0" }],
    [{ text: "2. 留着", callback_data: "5:1" }],
  ]);
  const settled = (card: Card) => render(card);
  assert.match(settled({ ...base, state: "decided", choice: 1 }).text, /你选了「留着」，已记录/);
  assert.deepEqual(settled({ ...base, state: "decided", choice: 1 }).buttons, []);
  assert.doesNotMatch(settled({ ...base, state: "decided", choice: 1 }).text, /1\. 删/);
  assert.match(settled({ ...base, state: "done", choice: 0, result: "删了" }).text, /你选了「删」。已执行：删了/);
  assert.match(settled({ ...base, state: "closed", result: "问题自己好了" }).text, /不用决定了：问题自己好了/);
  const notice = { ...base, kind: "notice" as const, options: ["已处理"], recommend: null };
  assert.deepEqual(render(notice).buttons, [[{ text: "已处理", callback_data: "5:0" }]]);
  assert.doesNotMatch(render(notice).text, /1\. 已处理/);
  const handled = render({ ...notice, state: "closed", options: [], result: "已处理", answer: "清了 3GB" });
  assert.match(handled.text, /处理说明：清了 3GB/);
  assert.throws(() => render({ ...base, text: "字".repeat(4100) }), /超过 4096/);
});

/** A Bot API that records each call, hands out two clicks once, and holds the next getUpdates open until it's stopped. */
async function fakeTelegram() {
  const calls: { method: string; body: any }[] = [];
  let updatesAsked = 0;
  const server = createServer(async (request: IncomingMessage, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const method = request.url!.replace(`/bot${TOKEN}/`, "");
    const body = raw ? JSON.parse(raw) : {};
    calls.push({ method, body });
    const reply = (out: object) => response.end(JSON.stringify(out));
    if (method === "getUpdates") {
      if (updatesAsked++ === 0) {
        const message = { message_id: 100, chat: { id: 7 } };
        return reply({
          ok: true,
          result: [
            { update_id: 11, callback_query: { id: "q1", from: { id: 42 }, message, data: "5:1" } },
            { update_id: 12, callback_query: { id: "q2", from: { id: 42 }, message, data: "not ours" } },
          ],
        });
      }
      const hold = setTimeout(() => reply({ ok: true, result: [] }), 5000);
      request.on("close", () => clearTimeout(hold));
      return;
    }
    if (method === "sendMessage" && body.text.includes("fail-me"))
      return reply({ ok: false, error_code: 400, description: "Bad Request: chat not found" });
    if (method === "sendMessage") return reply({ ok: true, result: { message_id: 100, chat: { id: 7 } } });
    if (method === "editMessageText" && body.text.includes("same as before"))
      return reply({ ok: false, error_code: 400, description: "Bad Request: message is not modified" });
    return reply({ ok: true, result: true });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  after(() => {
    server.closeAllConnections();
    server.close();
  });
  return { calls, api: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

test("telegram: sends once, changes the same message after, reports what fails, and only real clicks count", async () => {
  const { calls, api } = await fakeTelegram();
  const stop = new AbortController();
  const cards: Card[] = [
    base,
    { ...base, version: 2, ref: "7:100", state: "decided", choice: 1 },
    { ...base, id: 6, title: "fail-me" },
    { ...base, id: 8, version: 3, ref: "7:100", state: "closed", result: "same as before" },
  ];
  const hubCalls: unknown[][] = [];
  const logged: string[] = [];
  const hub = {
    async nextCard() {
      if (cards.length) return { card: cards.shift()! };
      const until = Date.now() + 3000;
      const heard = () =>
        calls.filter((c) => c.method === "answerCallbackQuery").length >= 2 &&
        calls.filter((c) => c.method === "getUpdates").length >= 2;
      while (!heard() && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 20));
      stop.abort();
      return { card: null };
    },
    async delivered(...args: unknown[]) {
      hubCalls.push(["delivered", ...args]);
      return {};
    },
    async failed(...args: unknown[]) {
      hubCalls.push(["failed", ...args]);
      return {};
    },
    async answer(...args: unknown[]) {
      hubCalls.push(["answer", ...args]);
      return { changed: true };
    },
  };
  await telegram({
    hub: hub as any,
    options: { token: TOKEN, chat: "7", api },
    log: (line) => logged.push(line),
    signal: stop.signal,
  });

  const sends = calls.filter((c) => c.method === "sendMessage");
  assert.equal(sends.length, 2, "one for the new card, one for the card that failed; none for updates");
  assert.equal(sends[0].body.chat_id, "7");
  assert.equal(sends[0].body.parse_mode, undefined, "what someone wrote is never read as markup");
  assert.deepEqual(sends[0].body.reply_markup.inline_keyboard[1], [{ text: "2. 留着", callback_data: "5:1" }]);
  const edits = calls.filter((c) => c.method === "editMessageText");
  assert.deepEqual([edits[0].body.chat_id, edits[0].body.message_id], ["7", 100]);
  assert.deepEqual(edits[0].body.reply_markup, { inline_keyboard: [] }, "a settled card loses its buttons");
  assert.deepEqual(
    hubCalls.filter((c) => c[0] === "delivered"),
    [
      ["delivered", 5, 1, "7:100"],
      ["delivered", 5, 2, "7:100"],
      ["delivered", 8, 3, "7:100"],
    ],
  );
  const failed = hubCalls.filter((c) => c[0] === "failed");
  assert.deepEqual(
    failed.map((c) => c.slice(0, 3)),
    [["failed", 6, 1]],
  );
  assert.match(String(failed[0][3]), /chat not found/);
  assert.deepEqual(
    hubCalls.filter((c) => c[0] === "answer"),
    [["answer", 5, { choice: 1, by: "42", ref: "7:100" }]],
  );
  const acknowledged = calls.filter((c) => c.method === "answerCallbackQuery").map((c) => c.body.callback_query_id);
  assert.deepEqual(acknowledged, ["q1", "q2"], "every click stops spinning");
  const asked = calls.filter((c) => c.method === "getUpdates");
  assert.equal(asked[1].body.offset, 13, "the clicks heard are confirmed");
  assert.deepEqual(asked[0].body.allowed_updates, ["callback_query"]);
  assert.ok(!JSON.stringify([logged, hubCalls]).includes("secret-token"));
});

test("telegram: a channel without a token or a chat says so", async () => {
  const run = (options: Record<string, unknown>) =>
    telegram({ hub: {} as any, options, log: () => {}, signal: AbortSignal.abort() });
  await assert.rejects(run({ chat: "7" }), /token/);
  await assert.rejects(run({ token: TOKEN }), /chat/);
});
