#!/usr/bin/env node
// The CDN build (cdn.marchjs.com): every browser entry of the package as a minified ES module, sharing its chunks, in
// cdn/dist/<version>/ — march.js (the "." entry), ui.js, app-ui.js, behaviors/drag.js, icons/lucide.js… — with
//   march.css        every stylesheet of every entry, in one file (a page links this one)
//   <entry>.css      the stylesheets of one entry (when it has any), what it is made of first
//   s/<rank>.css     each source stylesheet on its own, named by its place in the order; css.json: that order (the
//                    source paths) and each entry's sheets (a CDN app links these)
//   css/…            the stylesheets the package exports as files (tokens.css, themes/…)
//   importmap.json   { imports: { "march": ".../march.js", "march/ui": ".../ui.js", … } } with absolute URLs
//   sizes.json       per entry: gzip bytes a page downloads, on top of the core, and its closure (tools/cdn-size.mjs)
//   names.json       per entry its exported names; per barrel the smallest entry for each name (compiler/cdn.js)
//   sw.js            the service worker's code; a site's sw.js (march build, sw + cdn) imports it
//   components/<category>/<name>.js   one entry per component: a page loads what it uses (a barrel loads all)
//   mod/<path>.js    every module a barrel re-exports from (march/mod/<path>, for apps built with march.config.js › cdn)
//   files.json       every file of the version (a deploy uses it to keep the older versions)
//   data/…           the version's data: API reference, MarchIDE types, components (tools/cdn-data.mjs)
// (latest/ is served by the Worker as a redirect to it). Usage: node tools/build-cdn.js [--base https://cdn.marchjs.com]
import { readFileSync, writeFileSync, rmSync, cpSync, readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { writeData } from "./cdn-data.mjs";
import { measure, check, readBudget } from "./cdn-size.mjs";
import { exportMap } from "../compiler/deep-imports.js";
import { march } from "../compiler/esbuild.js";
import { cdnTargets, entryNames } from "../compiler/cdn.js";
import { swRuntime } from "../cli/perf.js";
import { cssOrder, entrySheets, ownRules } from "./cdn-css.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const argv = process.argv.slice(2);
const BASE = (argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "https://cdn.marchjs.com").replace(/\/$/, "");
const version = pkg.version;
const dist = join(root, "cdn", "dist"), out = join(dist, version);

// node-only or build-time entries stay out
const SKIP = new Set(["./testing", "./compiler", "./esbuild", "./register"]);
/** The entries: export subpath → { in: source, out: name in the version folder } */
const entries = [];
for (const [key, target] of Object.entries(pkg.exports)) {
  const file = typeof target === "string" ? target : target.import ?? target.default;
  if (SKIP.has(key) || typeof file !== "string" || !/\.(ts|js)$/.test(file) || !file.startsWith("./src/")) continue;
  // components/<category>/<name> are entries of their own in package.json (tools/gen-registry.js): one module per
  // component, so a page loads the components it uses and what they share (march/ui and the other barrels load every
  // component they export: no tree-shaking in a browser)
  if (key.includes("*")) {
    // icons/<pack> and icons/<pack>/pack: one entry per pack there is
    if (!key.startsWith("./icons/")) continue;
    const dir = join(root, "src/icons/packs");
    for (const id of existsSync(dir) ? readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()) : []) {
      const src = join(root, file.replace("*", id));
      if (existsSync(src)) entries.push({ spec: `march/${key.slice(2).replace("*", id)}`, in: src, out: key.slice(2).replace("*", id) });
    }
    continue;
  }
  entries.push({ spec: key === "." ? "march" : `march/${key.slice(2)}`, in: join(root, file), out: key === "." ? "march" : key.slice(2) });
}

// march/mod/<path>: a module a barrel re-exports from, as an entry of its own, where that saves a page something. A
// browser does not tree-shake, so an app built with `cdn` (compiler/cdn.js) imports each name from the smallest entry
// that has it: setTheme, which only march/ui (420 KB) exports, then loads its own module (10 KB). Every entry also
// splits the shared code finer (more files per page), so a module gets one only when it pays: outside a component's
// folder (a component's parts come with it), a name of it costs over MOD_MIN elsewhere, and the module itself is at most
// half that and within the entry budget. The first build measures every candidate; the ones that do not pay are
// dropped and the build runs again.
// (measured: at 30 or 60 KB, entries for the motion engine's modules split the code many components share finely enough
// to push line-chart and roadmap past their budget; at 100 KB the heavy barrels' helpers get one, and no entry grows)
const MOD_MIN = 100 * 1024;
const mods = [];
{
  const have = new Set(entries.map((e) => e.in));
  const found = new Set();
  for (const e of entries) if (!e.out.startsWith("icons/")) for (const [, def] of exportMap(e.in)) if (!have.has(def) && def.startsWith(join(root, "src")) && !def.startsWith(join(root, "src", "components")) && /\.(ts|tsx|js)$/.test(def)) found.add(def);
  for (const f of [...found].sort()) {
    const rel = relative(join(root, "src"), f).split("\\").join("/").replace(/\.(ts|tsx|js)$/, "");
    mods.push({ spec: `march/mod/${rel}`, in: f, out: `mod/${rel}` });
  }
}

const loader = { ".woff2": "file", ".woff": "file", ".png": "file", ".svg": "file", ".jpg": "file", ".webp": "file" };
const banner = { js: `/*! MarchJS v${version} | MIT | marchjs.com */`, css: `/*! MarchJS v${version} | MIT | marchjs.com */` };
const t0 = performance.now();
const url = (name) => `${BASE}/${version}/${name}`;
let meta = null;
/** The modules of `list` in the version folder, with its import map; returns their sizes (tools/cdn-size.mjs). */
async function compile(list) {
  rmSync(out, { recursive: true, force: true });
  ({ metafile: meta } = await esbuild.build({ absWorkingDir: root, metafile: true,
    entryPoints: list.map((e) => ({ in: e.in, out: e.out })), outdir: out, bundle: true, splitting: true, format: "esm",
    target: "es2022", minify: true, legalComments: "none", banner, loader, chunkNames: "_/[name]-[hash]", assetNames: "_/[name]-[hash]",
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning",
    // March's own .tsx sources (app-ui's AI panels) compiled by March's compiler, not as React JSX
    plugins: [march({ filter: /\.tsx$/, cssSplit: false, deepImports: false, prune: false })],
  }));
  writeFileSync(join(out, "importmap.json"), `${JSON.stringify({ imports: Object.fromEntries(list.map((e) => [e.spec, url(`${e.out}.js`)])) }, null, 2)}\n`);
  return measure(out);
}
/** The module entries that pay (see above), from a build that had them all. */
function paying(sizes) {
  const cost = new Map(); // defining file + name → the smallest other entry's size
  for (const e of entries) {
    const n = e.spec === "march" ? 0 : sizes.entries[e.spec]?.added;
    if (n == null || e.out.startsWith("icons/")) continue;
    for (const [name, def] of exportMap(e.in)) { const k = `${def}\0${name}`; if (!cost.has(k) || cost.get(k) > n) cost.set(k, n); }
  }
  const limit = readBudget().entry;
  return mods.filter((m) => {
    const own = sizes.entries[m.spec]?.added ?? Infinity;
    const elsewhere = Math.max(0, ...[...exportMap(m.in)].map(([name, def]) => cost.get(`${def}\0${name}`) ?? 0));
    return elsewhere > MOD_MIN && own * 2 <= elsewhere && own <= limit;
  });
}
const first = await compile([...entries, ...mods]);
const keep = paying(first);
if (keep.length < mods.length) await compile([...entries, ...keep]);
console.log(`module entries: ${keep.length} of ${mods.length} pay (march/mod/…)`);
entries.push(...keep);
// the stylesheets (tools/cdn-css.mjs): every source stylesheet as a sheet of its own (s/<rank>.css) in one order for the
// whole package, what a module is made of first. css.json lists the sheets in that order and, per entry, the ones its
// closure needs: a page links each sheet once, in that order (compiler/cdn.js), whatever order its modules load in.
// <entry>.css (one file per entry, for pages that link it by hand and for older compilers) and march.css (everything)
// are those sheets put together in the same order. A sheet is named by its rank (s/12.css): an app links an entry's
// sheets by their ranks alone (compiler/cdn.js), a few bytes per entry instead of an address per sheet.
{
  const rel = (p) => relative(root, p).split("\\").join("/");
  const order = cssOrder(meta, entries.map((e) => rel(e.in)));
  const closure = entrySheets(meta, rel(out));
  const used = new Set([...closure.values()].flat());
  const sheets = order.filter((k) => used.has(k));
  const rank = new Map(sheets.map((k, i) => [k, i]));
  const sheetOf = (k) => `s/${rank.get(k)}.css`;
  const body = new Map();
  for (const k of sheets) {
    const { code } = await esbuild.transform(readFileSync(join(root, k), "utf8"), { loader: "css", minify: true, legalComments: "none" });
    // a sheet is the source file as it is: an address relative to it would point elsewhere on the CDN
    if (/url\(\s*(?!["']?(?:data:|https?:|#))/.test(code)) throw new Error(`${k}: a relative url() in a component stylesheet (inline it as data: or put the file in src/css/)`);
    body.set(k, ownRules(code));
    mkdirSync(dirname(join(out, sheetOf(k))), { recursive: true });
    writeFileSync(join(out, sheetOf(k)), `${banner.css}\n${body.get(k)}\n`);
  }
  const joined = (list) => [banner.css, ...list.map((k) => body.get(k)).filter(Boolean)].join("\n") + "\n";
  const perEntry = {};
  for (const e of entries) {
    const list = (closure.get(e.out) ?? []).filter((k) => rank.has(k)).sort((a, b) => rank.get(a) - rank.get(b));
    if (!list.length) continue;
    perEntry[e.spec] = list.map((k) => rank.get(k));
    writeFileSync(join(out, `${e.out}.css`), joined(list));
  }
  writeFileSync(join(out, "css.json"), `${JSON.stringify({ version, named: "rank", sheets: sheets.map((k) => k.replace(/^src\//, "")), entries: perEntry })}\n`);
  // march.css: the design tokens first and the sx utilities (an app imports march/css/tokens.css and sx.css itself; a
  // CDN page links march.css alone), then every sheet
  const own = [];
  for (const f of ["tokens.css", "sx.css"]) own.push((await esbuild.transform(readFileSync(join(root, "src/css", f), "utf8"), { loader: "css", minify: true, legalComments: "none" })).code.trim());
  writeFileSync(join(out, "march.css"), joined([]) + [...own, ...sheets.map((k) => body.get(k)).filter(Boolean)].join("\n") + "\n");
}
// sw.js: the service worker's code every March site runs (a site's own sw.js sets its settings and imports this one)
writeFileSync(join(out, "sw.js"), `/*! MarchJS v${version} | MIT | marchjs.com */
${swRuntime()}`);
// the stylesheets the package exports as files
cpSync(join(root, "src/css"), join(out, "css"), { recursive: true });
// the fonts css/font.css points at (../fonts/…)
cpSync(join(root, "src/fonts"), join(out, "fonts"), { recursive: true });
// the version's data (API reference, MarchIDE types, components) for sites that render March without its sources
await writeData(out);

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const importmap = { imports: Object.fromEntries(entries.map((e) => [e.spec, url(`${e.out}.js`)])) };
writeFileSync(join(out, "importmap.json"), `${JSON.stringify(importmap, null, 2)}\n`);
// sizes.json: what a page downloads per entry (gzip; on top of the core; its closure files, which a site can
// modulepreload); an entry past its budget (cdn/budget.json, tools/cdn-size.mjs) fails the build before anything is published
const sizes = measure(out);
writeFileSync(join(out, "sizes.json"), `${JSON.stringify({ version, ...sizes })}\n`);
// names.json: what each entry exports and, per barrel, the smallest entry for each of its names. A compiler with
// march.config.js › cdn (compiler/cdn.js) reads it instead of March's sources: the CLI and the browser's compiler alike
{
  const own = entries.filter((e) => !e.out.startsWith("icons/"));
  const size = Object.fromEntries(entries.map((e) => [e.spec, e.spec === "march" ? 0 : sizes.entries[e.spec]?.added ?? Infinity]));
  const target = cdnTargets({ url: Object.fromEntries(entries.map((e) => [e.spec, e.in])), size }, Object.fromEntries(own.map((e) => [e.spec, e.in])));
  const exportsOf = {}, best = {};
  for (const e of own) {
    exportsOf[e.spec] = entryNames(e.in);
    for (const n of exportsOf[e.spec]) { const t = target(e.spec, n); if (t !== e.spec) (best[e.spec] ??= {})[n] = t; }
  }
  writeFileSync(join(out, "names.json"), `${JSON.stringify({ version, exports: exportsOf, best })}\n`);
}
const over = check(sizes, readBudget());
if (over.length) {
  for (const o of over) console.error(`✖ cdn size: ${o.spec} ${(o.size / 1024).toFixed(1)} KB > ${(o.limit / 1024).toFixed(1)} KB (cdn/budget.json)`);
  process.exit(1);
}
const files = walk(out).map((f) => relative(out, f).replace(/\\/g, "/")).sort();
writeFileSync(join(out, "files.json"), `${JSON.stringify({ version, files: [...files, "files.json"] }, null, 2)}\n`);
// latest/ is not a copy: the Worker sends /latest/… to the newest version's file (cdn/worker.js), so a release adds its
// files once (the Worker's static assets are counted against a limit)
rmSync(join(dist, "latest"), { recursive: true, force: true });

const size = walk(out).reduce((n, f) => n + statSync(f).size, 0);
console.log(`cdn/dist/${version}: ${entries.length} entries, ${files.length} files, ${(size / 1024 / 1024).toFixed(1)} MB (${Math.round(performance.now() - t0)} ms)`);
