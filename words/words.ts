// Words people read, in the language the rules ask for. A string is written t`…` in Simplified Chinese, and those words are
// its key: the code reads as it always has, a string no one has translated yet shows as it was written, and upstream's
// changes to a string merge as they are. zh-TW catalogs come from scripts/words.ts; English ones are kept by hand.
import en from "./en.ts";
import zhTW from "./zh-TW.ts";

export const LANGUAGES = ["zh-CN", "zh-TW", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
export type Catalogs = Partial<Record<Language, Record<string, string>>>;
export type Words = (strings: TemplateStringsArray, ...values: unknown[]) => string;

export const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

/** A string's key: its words, with {0}, {1}… where its values go. */
export function keyOf(strings: readonly string[]) {
  return strings.reduce((key, part, index) => `${key}{${index - 1}}${part}`);
}

// Everything outside the kernel speaks one language, the rules', set where they're read. The kernel is told in each decision.
let current: Language = "zh-CN";
export const spoken = () => current;
export function speak(language: unknown) {
  if (isLanguage(language)) current = language;
}

/** Words from these catalogs: in the language given, or in the one this process speaks. */
export function wordsIn(catalogs: Catalogs) {
  return (language: Language = current): Words => {
    const catalog = catalogs[language] ?? {};
    return (strings, ...values) => {
      const found = catalog[keyOf(strings)];
      if (found === undefined) return String.raw({ raw: strings }, ...values);
      // One pass over the translation: a value that looks like a placeholder stays as it is.
      return found.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)]));
    };
  };
}

/** A t`…` from these catalogs that speaks whatever this process speaks when it's used: what a plugin writes with. */
export function tagIn(catalogs: Catalogs): Words {
  const these = wordsIn(catalogs);
  return (strings, ...values) => these()(strings, ...values);
}

/** The core's words, which name no product: plugins keep their own catalogs beside them. */
export const words = wordsIn({ "zh-TW": zhTW, en });
export const t: Words = (strings, ...values) => words(current)(strings, ...values);
