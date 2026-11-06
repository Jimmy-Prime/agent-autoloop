// The Traditional Chinese documents, made from the Simplified Chinese ones: `node scripts/docs.ts` writes them, `--check`
// only says which are out of date. Links between documents go to the Traditional Chinese one where there is one, and each
// starts with a line to the other languages. The English documents are kept by hand.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, posix, relative } from "node:path";
import { toTaiwan } from "./words.ts";

const root = join(import.meta.dirname, "..");
const recipes = readdirSync(join(root, "examples", "recipes")).map((name) => `examples/recipes/${name}/README.md`);
/** Each Simplified Chinese document that has a Traditional Chinese one, as written in the repository. */
export const DOCUMENTS = [
  "README.md",
  "INSTALL.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "docs/protocol.md",
  "docs/plugins.md",
  "skills/agent-autoloop/SKILL.md",
  ...recipes,
];
const PICTURES = ["docs/architecture.svg"];

/** Where a document's other-language version lives: README.md → README.zh-TW.md. README.en.md was always English. */
export const versionOf = (file: string, language: "zh-TW" | "en") => file.replace(/\.(md|svg)$/, `.${language}.$1`);

function switcher(file: string) {
  const name = basename(file);
  const english = existsSync(join(root, versionOf(file, "en")))
    ? ` | [English](${basename(versionOf(name, "en"))})`
    : "";
  return `[简体中文](${name}) | **繁體中文**${english}\n\n`;
}

/** Points a link from one document to another at its Traditional Chinese version, when there is one. */
function linksTo(file: string, text: string) {
  const here = dirname(file);
  return text.replace(/\]\(((?![a-z]+:|#)[^)\s]+?\.(?:md|svg))(#[^)\s]*)?\)/g, (whole, target: string, anchor = "") => {
    const to = posix.normalize(posix.join(here, target));
    if (!DOCUMENTS.includes(to) && !PICTURES.includes(to)) return whole;
    return `](${posix.relative(here, versionOf(to, "zh-TW")) || basename(versionOf(to, "zh-TW"))}${anchor})`;
  });
}

/** The Simplified Chinese language line at the top of a README isn't the reader's: the switcher takes its place. */
const withoutLanguageLine = (text: string) => text.replace(/^\*\*简体中文\*\* \|.*\n\n/m, "");

export async function made(): Promise<Map<string, string>> {
  const taiwan = await toTaiwan();
  const out = new Map<string, string>();
  for (const file of DOCUMENTS) {
    const source = readFileSync(join(root, file), "utf8");
    const converted = taiwan(linksTo(file, withoutLanguageLine(source)));
    // After the first heading, so the title stays the title.
    const heading = /^# .*\n\n?/m.exec(converted);
    const at = heading ? heading.index + heading[0].length : 0;
    const note = "> 這份由 `scripts/docs.ts` 從簡體中文版自動轉換，改內容請改簡體中文版。\n\n";
    out.set(versionOf(file, "zh-TW"), converted.slice(0, at) + switcher(file) + note + converted.slice(at));
  }
  for (const file of PICTURES) {
    const source = readFileSync(join(root, file), "utf8");
    // Only the words drawn, not the markup around them.
    out.set(
      versionOf(file, "zh-TW"),
      source.replace(/>([^<]*)</g, (_, words: string) => `>${taiwan(words)}<`),
    );
  }
  return out;
}

if (process.argv[1] === import.meta.filename) {
  const files = await made();
  const stale = [...files].filter(
    ([file, text]) => !existsSync(join(root, file)) || readFileSync(join(root, file), "utf8") !== text,
  );
  if (process.argv.includes("--check")) {
    for (const [file] of stale) console.log(`${file} 要重新生成`);
    process.exitCode = stale.length ? 1 : 0;
  } else {
    for (const [file, text] of files) writeFileSync(join(root, file), text);
    console.log(
      `写好了 ${files.size} 份，其中 ${stale.length} 份有变化：${stale.map(([file]) => relative(root, join(root, file))).join("、")}`,
    );
  }
}
