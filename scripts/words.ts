// The strings people read, found where they're written, and their translations: `node scripts/words.ts` writes every zh-TW
// catalog from the Simplified Chinese and lists the English ones still missing; `--check` only says whether anything is out
// of date. A string is t`…`, with `t` from words/words.ts. What a plugin says is in its own folder, beside it.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { keyOf } from "../words/words.ts";

const root = join(import.meta.dirname, "..");
const FOLDERS = ["kernel", "host", "protocol", "worker", "cli", "plugins"];

/** Every .ts file under these folders, tests and catalogs left out. */
function sources(folder: string): string[] {
  return readdirSync(join(root, folder), { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".ts") && !/^(en|zh-TW)\.ts$/.test(entry.name) ? [path] : [];
  });
}

/** Where a template literal that starts at `start` (its backtick) ends, past its closing backtick. */
function templateEnd(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length) {
    const c = text[i];
    if (c === "\\") i += 2;
    else if (c === "`") return i + 1;
    else if (c === "$" && text[i + 1] === "{") i = expressionEnd(text, i + 2);
    else i++;
  }
  throw new Error("a template literal that doesn't end");
}

/** Where a ${…} that starts at `start` (just past its brace) ends, past its closing brace. */
function expressionEnd(text: string, start: number): number {
  let depth = 1;
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (c === "`") i = templateEnd(text, i);
    else if (c === '"' || c === "'") {
      i++;
      while (text[i] !== c) i += text[i] === "\\" ? 2 : 1;
      i++;
    } else {
      if (c === "{") depth++;
      if (c === "}" && --depth === 0) return i + 1;
      i++;
    }
  }
  throw new Error("a ${ that doesn't end");
}

/** The keys of every t`…` in a file's text. */
export function keysIn(text: string): string[] {
  const keys: string[] = [];
  for (const found of text.matchAll(/(?<![\w$.])t`/g)) {
    // A comment may name t`…` as code: only what runs counts.
    const line = text.slice(text.lastIndexOf("\n", found.index) + 1, found.index).trimStart();
    if (/^(\/\/|\/\*|\*)/.test(line)) continue;
    const start = found.index + 1;
    const end = templateEnd(text, start);
    // Its words as JavaScript reads them, with each value left out: the ${…} become empty and so can't run.
    let literal = "";
    for (let i = start; i < end;) {
      if (text[i] === "\\") {
        literal += text.slice(i, i + 2);
        i += 2;
      } else if (text[i] === "$" && text[i + 1] === "{") {
        literal += "${0}";
        i = expressionEnd(text, i + 2);
      } else literal += text[i++];
    }
    const strings = new Function(`return ((strings) => strings)${literal};`)() as string[];
    keys.push(keyOf(strings));
  }
  return keys;
}

/** Each catalog's folder and the keys written for it: the core's in words/, each plugin's in its own folder. */
export function catalogs(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>([["words", new Set()]]);
  for (const file of FOLDERS.flatMap(sources)) {
    const plugin = /^plugins\/([^/]+)\//.exec(file)?.[1];
    const owner = plugin ? `plugins/${plugin}` : "words";
    const keys = keysIn(readFileSync(join(root, file), "utf8"));
    if (!keys.length) continue;
    if (!found.has(owner)) found.set(owner, new Set());
    for (const key of keys) found.get(owner)!.add(key);
  }
  return found;
}

// docs/taiwan-inventory.md §3.4: the product's own words, and where OpenCC's Taiwan phrases miss what's meant here. Some
// are put right in the Simplified Chinese before OpenCC goes over it, the rest in what it gives back.
const BEFORE: [string | RegExp, string][] = [
  ["中台", "中控台"],
  // 对象 is a JSON or Git object only after these; anywhere else it's what an event is about, which in Taiwan stays 對象.
  // OpenCC would make even 對象 an object, so it goes through as a character it leaves alone.
  [/(?<!要是一个|要是|有限的|Git |JSON )对象/g, "\uE000"],
  ["全局", "整体"],
  ["模板", "范本"],
  // A database's transaction, which is all 事务 means here.
  ["事务", "交易"],
  ["打印", "印出"],
  ["回执", "回条"],
  ["进程", "行程"],
  ["账号", "帐号"],
  ["配置", "设置"],
  ["并发", "并行"],
  ["回调", "回呼"],
];
// 臺 is the formal form; on a screen in Taiwan it is 台 (平台、後台、中控台).
const AFTER: [string | RegExp, string][] = [
  ["引數", "參數"],
  ["臺", "台"],
  // Hair and animals never come up here: OpenCC takes 发卡 for a hairpin and 只 for a measure word.
  ["髮", "發"],
  ["隻", "只"],
  ["\uE000", "對象"],
  // OpenCC's Taiwan phrases make 权限 a 許可權; in Taiwan it's 權限, and §3.4's 凭据 is 憑證, 终端 a 終端機.
  ["許可權", "權限"],
  ["憑據", "憑證"],
  ["指令碼", "腳本"],
  [/終端(?!機)/g, "終端機"],
];

export async function toTaiwan(): Promise<(text: string) => string> {
  const OpenCC = await import("opencc-js/cn2t");
  const convert = OpenCC.Converter({ from: "cn", to: "twp" });
  const swap = (text: string, pairs: [string | RegExp, string][]) =>
    pairs.reduce((said, [a, b]) => (typeof a === "string" ? said.replaceAll(a, b) : said.replace(a, b)), text);
  return (text) => swap(convert(swap(text, BEFORE)), AFTER);
}

const quoted = (catalog: Record<string, string>) =>
  Object.entries(catalog)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join("\n");

const HEADER = {
  "zh-TW": "// Made by scripts/words.ts from the Simplified Chinese; not edited by hand.",
  en: "// English, kept by hand: every t`…` this catalog is for has a line here.",
};

/** A catalog as a file, the way Prettier would leave it, so formatting the repository doesn't make it out of date. */
export async function catalogFile(language: "zh-TW" | "en", catalog: Record<string, string>, path: string) {
  const body = Object.keys(catalog).length ? `{\n${quoted(catalog)}\n}` : "{}";
  const text = `${HEADER[language]}\nexport default ${body} as Record<string, string>;\n`;
  const prettier = await import("prettier");
  return prettier.format(text, { ...(await prettier.resolveConfig(path)), filepath: path });
}

const same = (a: Record<string, string>, b: Record<string, string>) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

async function readCatalog(folder: string, language: string): Promise<Record<string, string>> {
  try {
    return (await import(join(root, folder, `${language}.ts`))).default;
  } catch {
    return {};
  }
}

/** What's out of date: zh-TW catalogs that aren't what the Simplified Chinese makes, English lines missing or left over. */
export async function problems() {
  const taiwan = await toTaiwan();
  const said: string[] = [];
  const zhTW = new Map<string, string>();
  for (const [folder, keys] of catalogs()) {
    const made = Object.fromEntries([...keys].map((key) => [key, taiwan(key)]));
    zhTW.set(folder, await catalogFile("zh-TW", made, join(root, folder, "zh-TW.ts")));
    if (!same(await readCatalog(folder, "zh-TW"), made)) said.push(`${folder}/zh-TW.ts 要重新生成`);
    const en = await readCatalog(folder, "en");
    for (const key of keys) if (!(key in en)) said.push(`${folder}/en.ts 缺：${key}`);
    for (const key of Object.keys(en)) if (!keys.has(key)) said.push(`${folder}/en.ts 多了：${key}`);
  }
  return { said, zhTW };
}

if (process.argv[1] === import.meta.filename) {
  const { said, zhTW } = await problems();
  if (process.argv.includes("--check")) {
    for (const line of said) console.log(line);
    process.exitCode = said.length ? 1 : 0;
  } else {
    for (const [folder, file] of zhTW) writeFileSync(join(root, folder, "zh-TW.ts"), file);
    for (const line of said.filter((line) => !line.includes("zh-TW.ts"))) console.log(line);
    console.log(
      `写好了 ${zhTW.size} 份 zh-TW：${[...zhTW.keys()].map((folder) => relative(root, join(root, folder))).join("、")}`,
    );
  }
}
