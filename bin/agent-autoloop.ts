#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
// This machine's rules say what language to speak; it's known before anything with words in it is loaded. A file that
// can't be read or doesn't say speaks Simplified Chinese, and a hub elsewhere says its own when asked for its state.
import { readFileSync } from "node:fs";
import { RULES_FILE } from "../host/home.ts";
import { speak } from "../words/words.ts";

try {
  speak(JSON.parse(readFileSync(RULES_FILE, "utf8")).language);
} catch {}
await import("../cli/main.ts");
