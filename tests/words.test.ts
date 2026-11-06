// Words people read, in the language the rules ask for. Failure cases: a translation drops a value or puts one in the
// wrong place; a value that looks like a placeholder is filled in again; a string with no translation comes out empty or
// with its placeholders showing, instead of as it was written; a language that isn't one is taken, or changes what this
// process speaks; one plugin's words are looked up in another's.
import assert from "node:assert/strict";
import { test } from "node:test";
import { isLanguage, keyOf, speak, spoken, t, wordsIn } from "../words/words.ts";

const catalog = wordsIn({
  en: { "连续 {0} 次没跑成，最后一次是 {1}": "{1} was the last of {0} failed runs in a row", 已处理: "Handled" },
  "zh-TW": { 已处理: "已處理" },
});

test("a string's key is its words, with numbered places for its values", () => {
  const strings = Object.assign(["连续 ", " 次没跑成，最后一次是 ", ""], {
    raw: [],
  }) as unknown as TemplateStringsArray;
  assert.equal(keyOf(strings), "连续 {0} 次没跑成，最后一次是 {1}");
});

test("a translation puts each value where it says, and only once", () => {
  const en = catalog("en");
  assert.equal(en`连续 ${3} 次没跑成，最后一次是 ${"{0}"}`, "{0} was the last of 3 failed runs in a row");
  assert.equal(catalog("zh-TW")`已处理`, "已處理");
});

test("what isn't translated shows as it was written", () => {
  assert.equal(catalog("zh-CN")`连续 ${3} 次没跑成，最后一次是 ${"昨天"}`, "连续 3 次没跑成，最后一次是 昨天");
  assert.equal(catalog("zh-TW")`没有这条：${"早报"}`, "没有这条：早报");
  assert.equal(wordsIn({})("en")`已处理`, "已处理");
});

test("only the three languages are languages, and only they change what this process speaks", () => {
  assert.deepEqual(["zh-CN", "zh-TW", "en", "fr", "", undefined].map(isLanguage), [
    true,
    true,
    true,
    false,
    false,
    false,
  ]);
  const before = spoken();
  try {
    speak("en");
    assert.equal(spoken(), "en");
    speak("fr");
    assert.equal(spoken(), "en");
    assert.equal(catalog()`已处理`, "Handled", "a plugin's words follow what this process speaks");
    assert.equal(t`已处理`, "已处理", "the core's words aren't a plugin's");
  } finally {
    speak(before);
  }
});
