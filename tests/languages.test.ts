// What the three languages change, end to end. Failure cases: a prompt in one language tells an agent to start its last
// message with words the worker doesn't read, so a failed round counts as done and is never tried again; the hub's own
// words don't follow the rules' language, or follow the process's instead, so one decision says different things; the
// command line doesn't speak the language of the rules it runs with; who closed a card is stored in the rules' language,
// so the log says it differently from one language to the next.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { empty, evolve, rows } from "../kernel/evolve.ts";
import { decide } from "../kernel/decide.ts";
import { parseRules } from "../protocol/rules.ts";
import { promptFor, readMessage } from "../worker/contract.ts";
import { speak, spoken, type Language } from "../words/words.ts";

const fixture = readFileSync(new URL("./rules.fixture.json", import.meta.url), "utf8");
const CJK = /[㐀-鿿]/;

/** What the prompt tells an agent to write first, quoted as it says it: “没跑成：”, "FAILED:". */
const firstWords = (prompt: string) => [...prompt.matchAll(/[“"]([^”"]+[:：])[”"]/g)].map((found) => found[1]);

test("in every language, the first words a prompt asks for are ones the worker reads", () => {
  const before = spoken();
  try {
    for (const language of ["zh-CN", "zh-TW", "en"] as Language[]) {
      speak(language);
      const job = {
        run: 1,
        token: "t",
        attempt: 1,
        session: null,
        askFirst: ["删数据"],
        language,
        rule: { name: "意见", cwd: "/tmp", prompt: "按手册做。" },
        agent: { id: "a", name: "甲", use: "command", access: "edit" },
        context: { events: [], answers: [], timers: [], waiting: [], open: [], decided: [] },
      };
      const prompt = promptFor(job as never, "/tmp/context.json");
      const asked = firstWords(prompt);
      assert.ok(asked.length >= 2, `${language}: ${asked}`);
      const [failed, nothing] = asked.filter((words) => !/待你处理|待你處理|NEEDS YOU/.test(words));
      assert.equal(readMessage(`${failed} 连不上`).outcome, "failed", `${language}: ${failed}`);
      assert.equal(readMessage(`${nothing} 都好了`).outcome, "nothing", `${language}: ${nothing}`);
      if (language === "en") assert.ok(!CJK.test(prompt.replace(/意见|按手册做。|删数据|甲/g, "")), prompt);
    }
  } finally {
    speak(before);
  }
});

test("the hub's own words follow the rules' language, whatever the process speaks", () => {
  const before = spoken();
  speak("zh-CN");
  try {
    const said: Record<string, string> = {};
    for (const language of ["zh-CN", "zh-TW", "en"]) {
      const rules = { ...parseRules(fixture, 0, "UTC"), language };
      const view = evolve(
        empty(),
        decide(empty(), { type: "rules", args: [rules] }, 1, { secret: "s", publicUrl: "x" }).facts,
      );
      assert.throws(
        () => decide(view, { type: "answer", args: [99, { choice: 0 }] }, 2, { secret: "s", publicUrl: "x" }),
        (error: Error) => ((said[language] = error.message), true),
      );
    }
    // What the kernel checks events with says it in the rules' language too, not in the one the process speaks.
    const rules = { ...parseRules(fixture, 0, "UTC"), language: "zh-TW" };
    const environment = { secret: "s", publicUrl: "x" };
    const view = evolve(empty(), decide(empty(), { type: "rules", args: [rules] }, 1, environment).facts);
    const refused = new Set<string>();
    for (const language of ["zh-CN", "en"] as Language[]) {
      speak(language);
      assert.throws(
        () => decide(view, { type: "ingest", args: ["app", { id: "1", type: "Bad Type" }] }, 2, environment),
        (error: Error) => (refused.add(error.message), true),
      );
    }
    speak("zh-CN");
    assert.equal(refused.size, 1, [...refused].join(" / "));
    assert.match([...refused][0], /型別只能用|type 只能用小寫/);
    assert.equal(said["zh-CN"], "没有这张卡片");
    assert.equal(said["zh-TW"], "沒有這張卡片");
    assert.ok(said.en && !CJK.test(said.en), said.en);
  } finally {
    speak(before);
  }
});

test("who closed a card is stored as it always was, whatever the rules speak", () => {
  const environment = { secret: "s", publicUrl: "x" };
  const rules = { ...parseRules(fixture, 0, "UTC"), language: "en" };
  let view = evolve(empty(), decide(empty(), { type: "rules", args: [rules] }, 1, environment).facts);
  const act = (type: string, ...args: unknown[]) => {
    const decided = decide(view, { type, args }, 1000, environment);
    view = evolve(view, decided.facts);
    return decided.value;
  };
  act("ingest", "app", { id: "1", type: "feedback.new" });
  const first = act("claimNext", "w1", "c");
  act("finish", first.run, first.token, { outcome: "done", notice: [{ title: "要看一下", text: "磁碟快滿了" }] });
  const card = rows(view, "cards")[0];
  act("ingest", "app", { id: "2", type: "feedback.new" });
  const second = act("claimNext", "w1", "c");
  act("finish", second.run, second.token, { outcome: "done", resolve: [{ card: card.id, reason: "清掉了" }] });
  const closed = view.get("cards", card.id)!;
  assert.equal(closed.state, "closed");
  assert.equal(closed.by, `第 ${second.run} 轮`);
});

const dir = mkdtempSync(join(tmpdir(), "agent-autoloop-languages-"));
after(() => rmSync(dir, { recursive: true, force: true }));

test("the command line speaks the language of the rules it runs with", () => {
  const bin = join(import.meta.dirname, "..", "bin", "agent-autoloop.ts");
  const check = (language: string) => {
    const file = join(dir, `${language}.json`);
    writeFileSync(file, JSON.stringify({ language, sources: {}, agents: {}, rules: "not a list" }));
    const ran = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", bin, "check"], {
      env: { ...process.env, AGENT_AUTOLOOP_HOME: dir, AGENT_AUTOLOOP_RULES: file },
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.notEqual(ran.status, 0);
    return ran.stdout + ran.stderr;
  };
  assert.match(check("zh-CN"), /要是一个列表/);
  assert.match(check("zh-TW"), /要是一個列表/);
  const english = check("en");
  assert.ok(!CJK.test(english), english);
});
