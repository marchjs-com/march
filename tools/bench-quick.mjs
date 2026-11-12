#!/usr/bin/env node
// Speed › Comparison, quick check without the showcase build: bundles only the benchmark runner and the eight apps
// (esbuild + the March plugin, code splitting, one lazy chunk per library), serves them with the showcase's strict CSP
// and runs a short round in headless Edge/Chrome: every library mounts, passes the operations' DOM checks and reports
// numbers, with no page error (no CSP / Trusted Types violation). CI: node tools/bench-quick.mjs [--ops create1k,select]
import { rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve, extname } from "node:path";
import { build } from "esbuild";
import { march } from "../compiler/esbuild.js";
import { openHeadless, ROOT, flag } from "./lib/headless.mjs";

const SC = join(ROOT, "examples/showcase");
const out = resolve(process.env.TMP ?? join(ROOT, ".tmp"), "march-bench-quick");
const ops = flag(process.argv, "--ops", "create1k"); // CI short mode; --ops update,select,swap,remove,clear… for more
// measuring (not CI): --reps 20 --libs vanilla,march; "--ops all" runs every operation
const reps = Number(flag(process.argv, "--reps", "2"));
const libs = flag(process.argv, "--libs", "");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const entry = `
import { OPS, stats } from "./src/bench/core.ts";
import { LIBS } from "./src/bench/libs.ts";
import { runBench } from "./src/bench/runner.ts";
const stage = document.getElementById("stage");
const ops = ${JSON.stringify(ops)} === "all" ? OPS : ${JSON.stringify(ops.split(","))}.map((id) => OPS.find((o) => o.id === id));
const want = ${JSON.stringify(libs)};
runBench({ libs: want ? LIBS.filter((l) => want.split(",").includes(l.id)) : LIBS, ops, reps: ${reps}, warm: ${reps > 2 ? "undefined" : 1}, stage }).then((r) => {
  window.__bench = { errors: r.errors, memory: r.memory, first: r.firstPaint, medians: Object.fromEntries(Object.entries(r.samples).map(([l, o]) => [l, Object.fromEntries(Object.entries(o).map(([k, xs]) => [k, stats(xs).median]))])) };
}, (e) => { window.__bench = { fatal: String(e) }; });
`;
await build({
  stdin: { contents: entry, resolveDir: SC, sourcefile: "bench-quick.ts", loader: "ts" },
  bundle: true, splitting: true, format: "esm", outdir: out, minify: true, absWorkingDir: SC,
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
  await b.send("Page.navigate", { url: `${b.base}/` });
  const t0 = Date.now();
  while (!res && Date.now() - t0 < 15 * 60e3) { await new Promise((r) => setTimeout(r, 1000)); res = await b.ev("window.__bench"); }
  if (!res) fail.push("did not finish");
  else if (res.fatal) fail.push(res.fatal);
  else {
    for (const [lib, ms] of Object.entries(res.medians)) console.log(`${lib.padEnd(8)} ${Object.entries(ms).map(([o, x]) => `${o} ${x == null ? "—" : x.toFixed(1)}`).join("  ")}  mem ${res.memory[lib]?.toFixed(2) ?? "—"} MB  first ${res.first[lib]?.toFixed(1)}`);
    for (const [lib, e] of Object.entries(res.errors)) fail.push(`${lib}: ${JSON.stringify(e)}`);
    if (!libs && Object.keys(res.medians).length !== 8) fail.push(`${Object.keys(res.medians).length}/8 libraries`);
  }
  fail.push(...b.errs.filter(Boolean).map((e) => `page error: ${e}`));
} finally { await b.close(); server.close(); }
if (fail.length) { console.error(`✖ bench-quick:\n  ${fail.join("\n  ")}`); process.exit(1); }
console.log("✔ bench-quick: 8 libraries, strict CSP, all checks passed");
