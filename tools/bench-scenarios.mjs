#!/usr/bin/env node
// Speed › Comparison › realistic scenarios, quick check without the showcase build: bundles the scenario runner and
// every library's app (esbuild + the March plugin, one lazy chunk each), serves them with the showcase's strict CSP and
// runs them in headless Edge/Chrome. Every app must pass its scenario's DOM check, with no page error.
//   node tools/bench-scenarios.mjs [--scenarios ticker,tree] [--libs vanilla,march]
import { rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve, extname } from "node:path";
import { build } from "esbuild";
import { march } from "../compiler/esbuild.js";
import { openHeadless, ROOT, flag } from "./lib/headless.mjs";

const SC = join(ROOT, "examples/showcase");
// own output folder per run: several runs may build at the same time
const out = resolve(process.env.TMP ?? join(ROOT, ".tmp"), `march-bench-scenarios-${process.pid}`);
const want = flag(process.argv, "--scenarios", "");
const large = process.argv.includes("--large");
const cpu = process.argv.includes("--cpu"); // + a CPU profile (unminified): self time per function, top 25
const libs = flag(process.argv, "--libs", "vanilla,march,react,preact,vue,svelte,solid,lit");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
// --dir <scenario>: run one scenario folder straight from its files (<id>/def.ts default export + one app per
// library), before it is registered in list.ts and the per-library files — for writing a new scenario
const dir = flag(process.argv, "--dir", "");
const D = `./src/bench/scenarios/${dir}/`;
const has = (f) => existsSync(join(SC, "src/bench/scenarios", dir, f));
const direct = !dir ? "" : `
import def from "${D}def.ts";
import { withoutPolicyLookup } from "./src/bench/apps/no-tt.ts";
const one = (p) => p.then((m) => ({ ${JSON.stringify(dir)}: m.mount }));
const registry = {
  ${has("vanilla.ts") ? `vanilla: () => one(import("${D}vanilla.ts")),` : ""}
  ${has("march.tsx") ? `march: () => one(import("${D}march.tsx")),` : ""}
  ${has("react.ts") ? `react: () => one(import("${D}react.ts")),` : ""}
  ${has("preact.ts") ? `preact: () => one(import("${D}preact.ts")),` : ""}
  ${has("vue.ts") ? `vue: () => one(import("${D}vue.ts")),` : ""}
  ${has("solid.gen.js") ? `solid: () => one(import("${D}solid.gen.js")),` : ""}
  ${has("lit.ts") ? `lit: () => one(withoutPolicyLookup(() => import("${D}lit.ts"))),` : ""}
  ${has("svelte.gen.js") ? `svelte: () => withoutPolicyLookup(() => Promise.all([import("svelte"), import("${D}svelte.gen.js")])).then(([s, m]) => ({ ${JSON.stringify(dir)}: (host, data) => { const a = s.mount(m.default, { target: host, props: { data } }); s.flushSync(); return { step: (p) => a.step(p), destroy: () => { void s.unmount(a) } } } })),` : ""}
};
`;
const entry = `
import { SCENARIOS } from "./src/bench/scenarios/list.ts";
import { runScenarios } from "./src/bench/scenarios/runner.ts";
${direct}
const want = ${JSON.stringify(want)};
const scenarios = ${dir ? "[def]" : `want ? SCENARIOS.filter((s) => want.split(",").includes(s.id)) : SCENARIOS`};
runScenarios({ scenarios, libs: ${JSON.stringify(libs.split(","))}, stage: document.getElementById("stage"), large: ${large}${dir ? ", registry" : ""} }).then((r) => {
  window.__busy = r.busy; window.__scen = Object.fromEntries(Object.entries(r.results).map(([s, per]) => [s, Object.fromEntries(Object.entries(per).map(([l, x]) => [l, { median: x.stats.median, p95: [...x.samples].sort((a, b) => a - b)[Math.floor(x.samples.length * 0.95)] ?? null, dropped: x.dropped, n: x.samples.length, lo: x.stats.ci[0], hi: x.stats.ci[1], mount: x.mountMs ?? null, heap: x.heapMB ?? null, error: x.error ?? null }]))]));
}, (e) => { window.__scen = { fatal: String(e && e.stack || e) }; });
`;
await build({
  stdin: { contents: entry, resolveDir: SC, sourcefile: "bench-scenarios.ts", loader: "ts" },
  bundle: true, splitting: true, format: "esm", outdir: out, minify: !cpu, absWorkingDir: SC,
  alias: { "hadi-march": join(ROOT, "src") },
  define: { "process.env.NODE_ENV": '"production"', __VUE_OPTIONS_API__: "true", __VUE_PROD_DEVTOOLS__: "false", __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false" },
  plugins: [march({ components: join(SC, "src/components"), cssSplit: false })],
  loader: { ".css": "empty" }, logLevel: "error",
});
writeFileSync(join(out, "index.html"), `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="bench.css"><div id="stage"></div><script type="module" src="stdin.js"></script>`);
writeFileSync(join(out, "bench.css"), "#stage{block-size:12rem;overflow:hidden;contain:strict}");
const CSP = readFileSync(join(SC, "build.mjs"), "utf8").match(/export const CSP = "([^"]+)"/)[1];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const server = createServer((req, res) => {
  let p = resolve(out, "." + new URL(req.url, "http://x").pathname);
  if (!p.startsWith(out) || !existsSync(p) || statSync(p).isDirectory()) p = join(out, "index.html");
  res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream", "content-security-policy": CSP });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const b = await openHeadless({ base: `http://127.0.0.1:${server.address().port}`, args: ["--js-flags=--expose-gc", "--enable-precise-memory-info"] });
const fail = [];
let res;
try {
  if (cpu) { await b.send("Profiler.enable"); await b.send("Profiler.setSamplingInterval", { interval: 100 }); await b.send("Profiler.start"); }
  await b.send("Page.navigate", { url: `${b.base}/` });
  const t0 = Date.now();
  while (!res && Date.now() - t0 < 20 * 60e3) { await new Promise((r) => setTimeout(r, 1000)); res = await b.ev("window.__scen"); }
  if (!res) fail.push("did not finish");
  else if (res.fatal) fail.push(res.fatal);
  else for (const [s, per] of Object.entries(res)) {
    const busy = await b.ev("window.__busy");
    console.log(s + (busy?.includes(s) ? "  ⚠ machine busy" : ""));
    const best = Object.values(per).filter((x) => !x.error).sort((a, b) => a.median - b.median)[0];
    const base = per.vanilla?.median;
    for (const [lib, x] of Object.entries(per)) {
      console.log(`  ${lib.padEnd(8)} median ${x.median?.toFixed(2)} ms  p95 ${x.p95?.toFixed(2)}  dropped ${x.dropped}/${x.n}${base ? `  ×${(x.median / base).toFixed(2)}` : ""}  mount ${x.mount?.toFixed(1)} ms  heap ${x.heap?.toFixed(2)} MB${x !== best && best && x.lo <= best.hi && best.lo <= x.hi ? "  ≈ noise" : ""}${x.error ? `  ✖ ${x.error}` : ""}`);
      if (x.error) fail.push(`${s}/${lib}: ${x.error}`);
    }
  }
  fail.push(...b.errs.filter(Boolean).map((e) => `page error: ${e}`));
  if (cpu && res) {
    const { profile } = (await b.send("Profiler.stop")).result;
    const self = new Map(), dt = new Map();
    profile.samples.forEach((id, i) => dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
    for (const n of profile.nodes) { const f = n.callFrame; const k = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + (dt.get(n.id) ?? 0)); }
    console.log("self time (top 25):");
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${(v / 1000).toFixed(1).padStart(8)} ms  ${k}`);
  }
} finally { await b.close(); server.close(); rmSync(out, { recursive: true, force: true }); }
if (fail.length) { console.error(`✖ bench-scenarios:\n  ${fail.join("\n  ")}`); process.exit(1); }
console.log("✔ bench-scenarios: strict CSP, all checks passed");
