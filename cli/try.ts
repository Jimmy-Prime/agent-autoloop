// What `try` goes by. A run comes back to queued only by failing, and stays there until its retry, taking in any new
// event of its rule meanwhile: so the same run can be this try's, and only attempts tell an old failure from a new one.
// Its rule is the one that took its event, whatever the rule is called and whatever language it speaks.
export type TryRun = { id: number; rule: string; state: string; attempts: number; error: string; notBefore: string };

const failed = (rule: string) => (run: TryRun) => run.rule === rule && run.state === "queued" && run.attempts > 0;

/** A run of this rule still waiting for its retry as this try starts. */
export const waitingRetry = (runs: TryRun[], rule: string) => runs.find(failed(rule));

export const attemptsOf = (runs: TryRun[]) => new Map(runs.map((run) => [run.id, run.attempts]));

/** A run of this rule that has failed since those attempts were counted. */
export const newFailure = (runs: TryRun[], before: Map<number, number>, rule: string) =>
  runs.find((run) => failed(rule)(run) && run.attempts > (before.get(run.id) ?? 0));
