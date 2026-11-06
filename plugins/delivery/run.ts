// One delivery run: `node run.ts owner/name`, reading its event from AGENT_AUTOLOOP_CONTEXT and printing a receipt.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createIO } from "./github.ts";
import { deliver, disableAuto, status } from "./delivery.ts";
import { deliveryReceipt, question, receiptBlock, subjectNumber } from "./input.ts";
import { tagIn, speak } from "../../words/words.ts";
import en from "./en.ts";
import zhTW from "./zh-TW.ts";

const t = tagIn({ en, "zh-TW": zhTW });

const hasLabel = (issue: any, name: string) => issue.labels.some((label: any) => label.name === name);

export async function run(repo: string, context: any, testLocalHealth = false) {
  const number = subjectNumber(repo, context);
  const folder = mkdtempSync(join(tmpdir(), "agent-autoloop-delivery-"));
  const io = createIO(repo, folder);
  try {
    const issue = await io.api(`issues/${number}`);
    if (!issue.pull_request) {
      if (issue.state !== "open" || !hasLabel(issue, "ask-owner")) return t`没事可做：没有待处理的问题`;
      if (context.answers?.length) {
        await io.api(`issues/${number}/labels/ask-owner`, undefined, "DELETE");
        return t`已记录处理结果`;
      }
      return t`有一件事需要你处理\n${receiptBlock({ ask: [question(issue)] })}`;
    }
    try {
      const result = await deliver(repo, number, io, testLocalHealth);
      return deliveryReceipt(number, result, hasLabel(issue, "deliver-attended"));
    } catch (error) {
      const pr = await io.api(`pulls/${number}`);
      if (pr.auto_merge) await disableAuto(number, io);
      await status(io, pr.head.sha, "delivery", "failure", (error as Error).message);
      throw error;
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  // A process of its own, started by the worker: what it says, it says in the language the worker was told.
  speak(process.env.AGENT_AUTOLOOP_LANGUAGE);
  const [repo, ...args] = process.argv.slice(2);
  const context = JSON.parse(readFileSync(process.env.AGENT_AUTOLOOP_CONTEXT!, "utf8"));
  run(repo, context, args.includes("--test-local-health"))
    .then((text) => console.log(text))
    .catch((error) => {
      console.error((error as Error).message);
      process.exitCode = 1;
    });
}
