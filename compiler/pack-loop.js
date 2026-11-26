// The packing loop of `march build` (release): build → plan the small lazy modules → build again, until the planner
// settles; then, while small files are left, the same build with the other packing strategies. Each build is a full
// esbuild + entry merge + packChunks run (the expensive part), so the loop has a budget: at most `maxBuilds` builds and
// `maxMs` milliseconds. Past it the best build so far is kept (it may still leave small files: the build reports them).
// Every build prints one line: which step, how many small files, how long it took.
//
//   const res = await packLoop({ build, left, next, strategies: STRATEGIES.length, maxBuilds: 14, maxMs: 600_000 })
//   build(plan, strategy) → false when there is nothing to pack (dev build, no entry); left() → small files on disk;
//   next(plan) → the planner's next plan, or null when it is settled.

/** Default budget: builds and seconds (march.config.js › chunks.maxBuilds / chunks.maxSeconds, or the env overrides). */
export const PACK_BUDGET = { maxBuilds: 14, maxSeconds: 600 };

/**
 * @param {{ build: (plan: unknown, strategy: number) => Promise<boolean>, left: () => number, next: (plan: unknown) => unknown,
 *   strategies: number, start?: unknown, overBudget?: () => number, maxPasses?: number, maxBuilds?: number, maxMs?: number, now?: () => number, log?: (line: string) => void }} o
 * @returns {Promise<{ plan: unknown, strategy: number, small: number, builds: number, stopped: string | null }>}
 */
export async function packLoop({ build, left, next, strategies, start = null, overBudget = () => 0, maxPasses = 9, maxBuilds = PACK_BUDGET.maxBuilds, maxMs = PACK_BUDGET.maxSeconds * 1000, now = () => Date.now(), log = (l) => console.log(l) }) {
  const t0 = now();
  let builds = 0, stopped = null, onDisk = { plan: null, strategy: 0 }, lastOver = 0;
  // a build is better with fewer rows over budget, then fewer small files
  const better = (a, b) => a.o < b.o || (a.o === b.o && a.n < b.n);
  const over = () => {
    if (builds >= maxBuilds) return (stopped = `build limit (${maxBuilds})`);
    if (now() - t0 >= maxMs) return (stopped = `time limit (${Math.round(maxMs / 1000)} s)`);
    return null;
  };
  const run = async (plan, strategy, what) => {
    const t = now();
    const ok = await build(plan, strategy);
    builds++;
    onDisk = { plan, strategy };
    const small = ok ? left() : 0;
    lastOver = ok ? overBudget() : 0;
    log(`[pack] build ${builds} (${what}): ${small} small${lastOver ? `, ${lastOver} over budget` : ""}, ${((now() - t) / 1000).toFixed(1)} s`);
    return ok ? small : -1;
  };
  // passes: plan, build, plan again (strategy 0)
  // start: the plan the previous build settled on (incremental release builds): when nothing it groups changed, the
  // planner accepts it after one build instead of rebuilding the plan pass by pass
  // (start: { plan, strategy, small } — with the packing strategy it chose and what it left: when the plan settles at
  // once and leaves no more, that strategy is the answer and the search for another is skipped)
  let plan = start?.plan ?? null, settled = false, small = -1;
  const first = start?.strategy ?? 0;
  const seen = [];
  for (let pass = 0; pass < maxPasses; pass++) {
    const st = pass === 0 ? first : 0;
    small = await run(plan, st, `pass ${pass + 1}`);
    if (small < 0) return { plan, strategy: 0, small: 0, builds, stopped };
    const key = JSON.stringify(plan);
    if (!seen.some((x) => x.key === key)) seen.push({ plan, n: small, o: lastOver, key, s: st });
    const nxt = next(plan);
    if (!nxt) { settled = true; break; }
    // the planner's plans can cycle: a plan seen before ends the passes
    if (seen.some((x) => x.key === JSON.stringify(nxt))) break;
    if (over()) break;
    plan = nxt;
  }
  // the build on disk is the last one; its plan is `plan` (the passes may have ended on a newer, unbuilt plan)
  plan = onDisk.plan;
  let best = { plan, strategy: onDisk.strategy, n: small, o: lastOver };
  // an earlier pass may have done better than the last one (fewer rows over budget, then fewer small files): also when
  // the planner settled, since it can settle on a plan with a row over budget after a pass with none (the site's menu,
  // cold: pass 4 none over budget, pass 5 settled with one)
  for (const x of seen) if (better(x, best)) best = { plan: x.plan, strategy: x.s, n: x.n, o: x.o };
  const warm = settled && builds === 1 && start && small <= (start.small ?? 0);
  if (small > 0 && !stopped && !warm) {
    const plans = settled ? [{ plan, n: small }] : [...seen].sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0)).slice(0, 2);
    search: for (const p of plans) for (let s = 0; s < strategies; s++) {
      if (p.plan === onDisk.plan && s === onDisk.strategy) continue; // that build is on disk
      if (over()) break search;
      const n = await run(p.plan, s, `last step, strategy ${s}`);
      if (n < 0) break search;
      if (better({ n, o: lastOver }, best)) best = { plan: p.plan, strategy: s, n, o: lastOver };
      if (!n && !lastOver) break search;
    }
  }
  // the best build back on disk when it is not the last one (allowed past the budget: the output must be the best)
  if (onDisk.plan !== best.plan || onDisk.strategy !== best.strategy) await run(best.plan, best.strategy, "best again");
  log(`[pack] ${builds} build(s) in ${((now() - t0) / 1000).toFixed(1)} s, ${best.n} small file(s) left${stopped ? `; stopped at the ${stopped}` : ""}`);
  return { plan: best.plan, strategy: best.strategy, small: best.n, builds, stopped };
}
