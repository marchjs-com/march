#!/usr/bin/env node
// Speed › Comparison, profiling aid (not CI): the synchronous script time of every benchmark operation, without the
// paint that follows (the operation call alone, after the same set-up the page runs). Also the heap per 1.000 rows and
// the DOM node count. Use it to find where a library spends its time; the page's numbers include style, layout, paint.
//   node tools/bench-profile.mjs [--libs vanilla,march] [--reps 15] [--ops all|create1k,swap]
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { build } from "esbuild";
import { march } from "../compiler/esbuild.js";
import { openHeadless, ROOT, flag } from "./lib/headless.mjs";

const SC = join(ROOT, "examples/showcase");
const out = resolve(process.env.TMP ?? join(ROOT, ".tmp"), "march-bench-profile");
const libs = flag(process.argv, "--libs", "vanilla,march");
const reps = Number(flag(process.argv, "--reps", "15"));
const ops = flag(process.argv, "--ops", "all");
const cpu = process.argv.includes("--cpu"); // + a CPU profile: self time per function (unminified build)
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const entry = `
import { OPS, rowSource, stats } from "./src/bench/core.ts";
import { LIBS } from "./src/bench/libs.ts";
import { probe } from "./src/bench/runner.ts";
import { afterPaint } from "./src/bench/paint.ts";
const want = ${JSON.stringify(ops)};
const ops = want === "all" ? OPS : OPS.filter((o) => want.split(",").includes(o.id));
const stage = document.getElementById("stage");
const heap = () => performance.memory.usedJSHeapSize;
const settle = async () => { gc(); await new Promise((r) => setTimeout(r, 20)); await afterPaint(); };
(async () => {
  const res = {}, apps = [];
  // every library mounted at once, measured in turns (sample i of each library back to back), so a busy machine
  // slows all of them alike and the ratios hold
  for (const lib of LIBS.filter((l) => ${JSON.stringify(libs)}.split(",").includes(l.id))) {
    const host = document.createElement("div"); stage.append(host);
    const app = await (await lib.load()).mount(host);
    const dom = probe(host), rows = rowSource(1), r = (res[lib.id] = {});
    await settle(); const h0 = heap();
    app.run(rows(1000)); await settle();
    r.heapKB = Math.round((heap() - h0) / 1024);
    r.nodes = host.getElementsByTagName("*").length;
    app.clear(); await settle();
    apps.push({ id: lib.id, app, dom, rows, r });
  }
  for (const op of ops) {
    const xs = new Map(apps.map((a) => [a.id, []]));
    for (let i = 0; i < ${reps} + op.warm; i++) {
      for (const a of apps) {
        op.setup(a.app, a.rows, a.dom); await afterPaint(); await settle(); op.mark?.(a.dom);
        const t0 = performance.now(); op.act(a.app, a.rows, a.dom); const t = performance.now() - t0;
        await afterPaint();
        if (!op.check(a.dom)) xs.get(a.id).push(NaN);
        else if (i >= op.warm) xs.get(a.id).push(t);
        a.app.clear(); await afterPaint();
      }
    }
    for (const a of apps) a.r[op.id] = stats(xs.get(a.id)).median;
  }
  for (const a of apps) a.app.destroy();
  window.__prof = res;
})().catch((e) => { window.__prof = { fatal: String(e && e.stack || e) }; });
`;
await build({
  stdin: { contents: entry, resolveDir: SC, sourcefile: "bench-profile.ts", loader: "ts" },
  bundle: true, splitting: true, format: "esm", outdir: out, minify: !cpu, absWorkingDir: SC,
  alias: { "march": join(ROOT, "src") },
  define: { "process.env.NODE_ENV": '"production"', __VUE_OPTIONS_API__: "true", __VUE_PROD_DEVTOOLS__: "false", __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false" },
  plugins: [march({ components: join(SC, "src/components"), cssSplit: false })],
  loader: { ".css": "empty" }, logLevel: "error",
});
writeFileSync(join(out, "index.html"), `<!doctype html><meta charset="utf-8"><div id="stage" style="block-size:12rem;overflow:hidden;contain:strict"></div><script type="module" src="stdin.js"></script>`);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript" };
const server = createServer((req, res) => {
  let p = resolve(out, "." + new URL(req.url, "http://x").pathname);
  if (!p.startsWith(out) || !existsSync(p) || statSync(p).isDirectory()) p = join(out, "index.html");
  res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const b = await openHeadless({ base: `http://127.0.0.1:${server.address().port}`, args: ["--js-flags=--expose-gc", "--enable-precise-memory-info"] });
let res;
try {
  if (cpu) { await b.send("Profiler.enable"); await b.send("Profiler.setSamplingInterval", { interval: 100 }); await b.send("Profiler.start"); }
  await b.send("Page.navigate", { url: `${b.base}/` });
  const t0 = Date.now();
  while (!res && Date.now() - t0 < 15 * 60e3) { await new Promise((r) => setTimeout(r, 1000)); res = await b.ev("window.__prof"); }
  if (cpu && res) {
    const { profile } = (await b.send("Profiler.stop")).result;
    const self = new Map(), dt = new Map();
    profile.samples.forEach((id, i) => dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
    for (const n of profile.nodes) { const f = n.callFrame; const k = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + (dt.get(n.id) ?? 0)); }
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    console.log("self time (top 30):");
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${(v / 1000).toFixed(1).padStart(8)} ms ${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`);
  }
} finally { await b.close(); server.close(); }
if (!res || res.fatal) { console.error(res?.fatal ?? "did not finish"); process.exit(1); }
const keys = Object.keys(Object.values(res)[0]);
console.log(["lib".padEnd(8), ...keys.map((k) => k.padStart(9))].join(" "));
for (const [lib, r] of Object.entries(res)) console.log([lib.padEnd(8), ...keys.map((k) => (typeof r[k] === "number" ? (Number.isInteger(r[k]) ? String(r[k]) : r[k].toFixed(2)) : "—").padStart(9))].join(" "));
