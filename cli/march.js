#!/usr/bin/env node
// HADI March CLI
//   march dev [--port 5173] [--mock [openapi.json]]  dev server: rebuild on change, live reload, error overlay, optional mock API
//                                                    (--mock also sets globalThis.MARCH_MOCK for net.mock in the app)
//   march build [--release] [--no-minify]            release bundle (code splitting, chunk planning with the 10 KB floor,
//                                                    entry merge, budgets, prerender, public/ copied); --timing: phase times
//   march build --dev [--watch]                      fast build: one esbuild pass, no chunk planning / prerender, budgets
//                                                    only warn; --watch rebuilds incrementally (esbuild context)
//   march gen routes                                 src/pages/** → src/routes.gen.js (+ pages.d.ts param types)
//   march gen page users/[id] | gen component Name | gen crud products
//   march gen api openapi.json [--out src/api.gen.js] typed client + schemas from an OpenAPI 3 document
//                 [--classes]                       hadi-march/net Api classes + interfaces instead (src/api.gen.ts)
//   march i18n [--messages src/i18n]                 report keys missing from translation files
//   march check [--src src]                          type-check .tsx/.ts including March syntax (pipes, modifiers…)
//   march seo check [--dir dist] [--no-canonical]    built pages: missing title / description / canonical / img alt…
//   march icons list | add lucide … | gallery <dir>  open-source icon sets → hadi-march/icons/<pack> (see cli/icons.js)
// Config (optional): march.config.js exporting { entry, outdir, publicDir, pagesDir, components, alias, define, port, html,
//   base: "/" | "/app/" | "./" (asset URLs in index.html; "./" = works from any sub-folder), redirects: true (_redirects for
//   Cloudflare Pages / Netlify, absolute base only), fallback404: false (no 404.html), stableNames: true (or --stable-names:
//   main.js, chunks/home.js… with ?v=<version> in every reference; deploys overwrite the same paths), packChunks: false,
//   budget: { entry, route, part, css, routes: { "/x": bytes }, fail } (gzip bytes; false = off), sw: true (offline service worker), headers: false (no _headers),
//   credit: true (adds <!-- Built with HADI March --> to the built index.html and prints the one-line console banner in production too; off by default),
//   banner: false (no console banner in `march dev`; production never prints one unless credit is on) }.
//   seo: { site, prerender: true | ["/a"], sitemap, robots, head } (compiler/prerender.js: static HTML per route + sitemap.xml/robots.txt) }.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, cpSync, rmSync, watch } from "node:fs";
import { join, resolve, relative, dirname, extname, basename, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { march } from "../compiler/esbuild.js";
import { genRoutes } from "./routes.js";
import { genApi, genApiClasses, mockHandler } from "./openapi.js";
import { bannerSource } from "./banner.js";
import { templates } from "./templates.js";
import { mergeEntry, rehashOutputs } from "../compiler/merge-entry.js";
import { packChunks, STRATEGIES } from "../compiler/pack-chunks.js";
import { planSmallLazy, smallFiles, aliasGroups } from "../compiler/min-chunks.js";
import { chunkManifest, sizeReport, printReport, headersFile, swSource, buildVersion, topInputs, routePaths, overText, fileSizes } from "./perf.js";
import { posix } from "../compiler/fs-util.js";

const cwd = process.cwd();
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true) : d; };
const MARCH_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const marchVersion = () => JSON.parse(readFileSync(join(MARCH_ROOT, "package.json"), "utf8")).version;

async function loadConfig() {
  const f = join(cwd, "march.config.js");
  const user = existsSync(f) ? (await import(pathToFileURL(f).href)).default ?? {} : {};
  const cfg = { entry: "src/main.jsx", outdir: "dist", publicDir: "public", pagesDir: "src/pages", components: "src/components", html: "index.html", port: 5173, alias: {}, define: {}, ...user };
  // the file that exists (esbuild would quietly take main.tsx for main.jsx, and the entry would not be recognised)
  if (!existsSync(resolve(cwd, cfg.entry))) cfg.entry = [".tsx", ".ts", ".jsx", ".js"].map((x) => cfg.entry.replace(/\.[jt]sx?$/, x)).find((p) => existsSync(resolve(cwd, p))) ?? cfg.entry;
  return cfg;
}

async function loadEsbuild() {
  for (const base of [join(cwd, "package.json"), join(MARCH_ROOT, "package.json")]) {
    try { const req = createRequire(base); return await import(pathToFileURL(req.resolve("esbuild")).href).then((m) => m.default ?? m); } catch { /* next */ }
  }
  fail("esbuild is required: npm i -D esbuild (it is March's only build dependency).");
}
/** Phase timer: `--timing` or MARCH_TIMING=1 prints each build phase (ms) and pass counts; MARCH_TIMING=<file> writes JSON. */
function timer() {
  const on = flag("--timing") === true || !!process.env.MARCH_TIMING;
  const rows = [], counts = {};
  let last = performance.now();
  const t = (name) => { const now = performance.now(); rows.push([name, now - last]); last = now; };
  t.count = (k) => { counts[k] = (counts[k] ?? 0) + 1; };
  t.print = () => {
    if (!on) return;
    const sum = {};
    for (const [n, ms] of rows) sum[n] = (sum[n] ?? 0) + ms;
    console.log(`  timing: ${Object.entries(sum).map(([n, ms]) => `${n} ${Math.round(ms)}`).join(", ")} ms; ${Object.entries(counts).map(([k, n]) => `${k} ×${n}`).join(", ")}`);
    if (process.env.MARCH_TIMING && process.env.MARCH_TIMING !== "1") writeFileSync(process.env.MARCH_TIMING, JSON.stringify({ phases: sum, counts }, null, 2));
  };
  return t;
}
function fail(msg) { console.error(`\x1b[31m✖\x1b[0m ${msg}`); process.exit(1); }

function buildOptions(cfg, esbuild, { dev, plan = null }) {
  return {
    entryPoints: [resolve(cwd, cfg.entry)],
    bundle: true, format: "esm", splitting: true, target: "es2022",
    outdir: resolve(cwd, cfg.outdir, "assets"),
    entryNames: dev ? "[name]" : "[name]-[hash]", chunkNames: "chunks/[name]-[hash]", assetNames: "[name]-[hash]",
    minify: !dev && flag("--no-minify") !== true, sourcemap: dev ? "linked" : false,
    metafile: true, write: true, logLevel: "silent", legalComments: "none", charset: "utf8",
    define: { "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"), ...cfg.define },
    alias: cfg.alias,
    loader: { ".svg": "file", ".png": "file", ".woff2": "file", ".jpg": "file", ".webp": "file" },
    // compile cache (compiler/esbuild.js): every build and every planner pass reuses March modules compiled before;
    // off with cache: false in march.config.js
    plugins: [march({ components: resolve(cwd, cfg.components), dev, i18nOut: resolve(cwd, cfg.outdir, "i18n-keys.json"), ...(cfg.cache === false ? {} : { cache: resolve(cwd, "node_modules", ".cache", "march", "compile") }), ...(plan ? { inline: plan.inline, groups: plan.groups } : {}) })],
  };
}

/** Write index.html with the hashed entry script/style tags (no inline scripts). */
function writeHtml(cfg, meta, { dev }, manifest = null, entryFiles = null) {
  const out = resolve(cwd, cfg.outdir);
  const src = existsSync(join(cwd, cfg.html)) ? readFileSync(join(cwd, cfg.html), "utf8") : templates.indexHtml();
  // the app entry (lazy pages are entry points of their own chunks too, so match the configured entry file)
  const want = resolve(cwd, cfg.entry);
  const entry = Object.entries(meta.outputs).find(([, o]) => o.entryPoint && resolve(cwd, o.entryPoint) === want) ?? Object.entries(meta.outputs).find(([, o]) => o.entryPoint);
  // base: "/" (default, history routing on any path) or "./" (relative: the app works from any sub-folder)
  const base = dev ? "/" : cfg.base ?? "/";
  const v = (k) => (meta.outputs[k]?.version ? `?v=${meta.outputs[k].version}` : "");
  const js = `${base}${relative(out, resolve(cwd, entry[0])).split(sep).join("/")}${v(entry[0])}`;
  const css = entry[1].cssBundle ? `${base}${relative(out, resolve(cwd, entry[1].cssBundle)).split(sep).join("/")}${v(entry[1].cssBundle)}` : null;
  // the chunk manifest is a JSON data block (never executed, so CSP script-src does not apply); the router and lazy()
  // read it to preload all of a route's files at once
  const data = manifest && Object.keys(manifest).length ? `<script type="application/json" id="march-manifest">${JSON.stringify(manifest).replace(/</g, "\\u003c")}</script>` : "";
  // the entry's own chunks are announced up front: fetched in parallel with the entry instead of after it is parsed
  const pre = (entryFiles ?? []).filter((f) => /\.js(\?|$)/.test(f) && `${base}${f}` !== js).map((f) => `<link rel="modulepreload" href="${base}${f}">`).join("");
  // an absolute base ("/app/") is written down for the router and appUrl() (hadi-march/base); a relative build ("./")
  // finds its root from the entry script instead
  const baseTag = base.startsWith("/") ? `<meta name="march-base" content="${base.replace(/\/?$/, "/")}">` : "";
  const tags = `${cfg.credit === true ? "<!-- Built with HADI March -->" : ""}${baseTag}${css ? `<link rel="stylesheet" href="${css}">` : ""}${data}${pre}<script type="module" src="${js}"></script>${dev ? '<script type="module" src="/__march/client.js"></script>' : cfg.credit === true ? `<script src="${base}credit.js"></script>` : ""}`;
  const html = src.includes("<!--march-->") ? src.replace("<!--march-->", tags) : src.replace("</head>", `${tags}</head>`);
  writeFileSync(join(out, "index.html"), html);
  if (!dev && cfg.credit === true) writeFileSync(join(out, "credit.js"), bannerSource(marchVersion()));
}

/** Theme stylesheets for setColorTheme(): copied to <outdir>/themes/<id>.css (the default theme is already in the bundle). */
async function copyThemes(out, esbuild, { dev }) {
  const dir = join(MARCH_ROOT, "src", "css", "themes");
  if (!existsSync(dir)) return;
  mkdirSync(join(out, "themes"), { recursive: true });
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".css"))) {
    const css = readFileSync(join(dir, f), "utf8");
    writeFileSync(join(out, "themes", f), dev ? css : (await esbuild.transform(css, { loader: "css", minify: true, legalComments: "none" })).code);
  }
}

/** Budget of a lazy output (gzip bytes): a start-up piece, a route (its page module) or a lazy part; undefined without a budget. */
function budgetOf(budget, meta, plan) {
  if (!budget) return undefined;
  const boot = new Set((budget.boot ?? []).map((k) => k.split(sep).join("/")));
  const outs = meta.outputs;
  const routes = routePaths(meta, cwd, Object.values(outs).map((o) => o.entryPoint).filter(Boolean).map((k) => k.split(sep).join("/")));
  const of = (k) => {
    const ep = (outs[k]?.entryPoint ?? "").split(sep).join("/");
    if (!ep) return undefined;
    // a group of small pages / parts (min-chunks): each member's download includes the whole group
    if (ep.startsWith("march-group:")) return plan?.boot?.includes(ep.slice(12)) ? { boot: true } : { limit: budget.route ?? 60 * 1024 };
    if (boot.has(ep)) return { boot: true };
    const path = routes[ep];
    // budget.parts: a lazy part with its own, argued limit ({ limit, why }), e.g. a third-party library loaded on demand
    return { limit: path ? budget.routes?.[path] ?? budget.route ?? 60 * 1024 : budget.parts?.[ep]?.limit ?? budget.part ?? budget.route ?? 60 * 1024 };
  };
  // start-up beyond the entry (the "(boot)" row of the size report)
  of.bootLimit = budget.bootLimit ?? budget.route ?? 60 * 1024;
  // a shared "common" chunk is a lazy download of its own: the part budget
  of.partLimit = budget.part ?? budget.route ?? 60 * 1024;
  return of;
}

async function build({ dev = false } = {}) {
  const T = timer();
  const cfg = await loadConfig();
  const esbuild = await loadEsbuild();
  T("config");
  if (existsSync(resolve(cwd, cfg.pagesDir))) genRoutes(resolve(cwd, cfg.pagesDir), resolve(cwd, "src/routes.gen.js"));
  const out = resolve(cwd, cfg.outdir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  if (existsSync(resolve(cwd, cfg.publicDir))) cpSync(resolve(cwd, cfg.publicDir), out, { recursive: true });
  T("routes+public");
  const t0 = Date.now();
  try {
    // chunks.minSize: no output file under it (default 10 KB before gzip); small lazy modules need a second pass
    const minSize = cfg.chunks === false ? 0 : cfg.chunks?.minSize ?? cfg.packChunks?.minSize ?? 10240;
    const allow = (cfg.chunks && cfg.chunks.allow) || {};
    // the planners aim 5% over the floor: their sizes come before the final rewrites (shorter import names, CSS loaders
    // stripped), which shrink a file a little — a chunk planned at 10.1 KB must not end at 9.9 KB
    const aim = Math.ceil(minSize * 1.05);
    let plan = null, r, entryKey = null, builds = 0, seen = [], settled = false, rPlan = null;
    // one build: esbuild, then (production) the entry merge and the chunk packer with the given packing strategy
    const once = async (strategy) => {
      if (builds++) rmSync(resolve(out, "assets"), { recursive: true, force: true });
      if (builds > 1) T("clean");
      r = await esbuild.build(buildOptions(cfg, esbuild, { dev, plan }));
      rPlan = plan;
      T("esbuild"); T.count("esbuild");
      entryKey = null;
      // production: the entry and its static chunks become one file (fewer requests, better compression)
      if (dev || cfg.mergeEntry === false) return false;
      const want = resolve(cwd, cfg.entry);
      entryKey = Object.keys(r.metafile.outputs).find((k) => r.metafile.outputs[k].entryPoint && resolve(cwd, r.metafile.outputs[k].entryPoint) === want);
      if (!entryKey) return false;
      const minify = flag("--no-minify") !== true;
      await mergeEntry(r.metafile, { cwd, entryKey, esbuild, minify });
      T("mergeEntry");
      // small shared chunks fold into a chunk loaded with them, else the cheapest partner; off with packChunks: false
      if (cfg.packChunks !== false) await packChunks(r.metafile, { cwd, entryKey, esbuild, minify, minSize: aim || 2048, budgetOf: budgetOf(cfg.budget, r.metafile, plan), strategy });
      T("packChunks");
      return true;
    };
    const left = () => (minSize && entryKey ? smallFiles(r.metafile, { cwd, minSize, allow, entryKey, boot: cfg.budget?.boot ?? [], plan }).length : 0);
    for (let pass = 0; pass < 9; pass++) {
      if (!(await once(0))) break;
      const n = left();
      if (process.env.MARCH_DEBUG_COMMON) console.log(`[pack] pass ${pass}: ${n} small`, smallFiles(r.metafile, { cwd, minSize, allow, entryKey, boot: cfg.budget?.boot ?? [], plan }).map((x) => `${x.file.split("/").pop()} ${x.bytes}`).join(", "));
      if (!seen.some((x) => x.key === JSON.stringify(plan))) seen.push({ plan, n, key: JSON.stringify(plan) });
      // chunks.commonRoom (gzip bytes): page groups stay this far under the route budget, so the shared "common" chunk
      // (pack-chunks.js) still fits on every route that loads it
      const next = minSize ? planSmallLazy(r.metafile, { cwd, entryKey, minSize: aim, allow, boot: cfg.budget?.boot ?? [], prev: plan, maxLoad: cfg.budget ? cfg.budget.route : undefined, room: cfg.chunks?.commonRoom ?? 0, ...(cfg.chunks?.routeTables ? { tables: cfg.chunks.routeTables } : {}) }) : null;
      T("planSmallLazy"); T.count("planSmallLazy");
      if (!next) { settled = true; break; }
      // the planner's plans can cycle (a group taken apart, rebuilt, taken apart again): a plan seen before ends the passes
      if (seen.some((x) => x.key === JSON.stringify(next))) break;
      plan = next;
    }
    // last step of packing: small files still left on the final plan → the same build with the next packing strategy
    // (another fold order). The planner may not settle (its plans can cycle): then every plan it made is tried, the one
    // with the fewest small files first. The first build with none left wins, else the one with the fewest (it fails).
    plan = rPlan; // the plan of the build on disk (the passes may end on a newer one)
    if (!dev && entryKey && cfg.packChunks !== false && left()) {
      const last = plan;
      let best = { plan, s: 0, n: left() };
      const plans = settled ? [{ plan, n: best.n }] : [...seen].sort((a, b) => a.n - b.n).slice(0, 2);
      search: for (const p of plans) for (let s = 0; s < STRATEGIES.length; s++) {
        if (p.plan === last && s === 0) continue; // the build already done
        plan = p.plan;
        if (!(await once(s))) break search;
        const n = left();
        T.count("strategy");
        if (process.env.MARCH_DEBUG_COMMON) console.log(`[pack] plan n${p.n} strategy ${s}: ${n} small`, smallFiles(r.metafile, { cwd, minSize, allow, entryKey, boot: cfg.budget?.boot ?? [], plan }).map((x) => `${x.file.split("/").pop()} ${x.bytes}`).join(", "));
        if (n < best.n) best = { plan, s, n };
        if (!n) break search;
      }
      if (best.n) { plan = best.plan; await once(best.s); }
    }
    // final names: every rewritten file gets a new content version (a cached file must never point at another build),
    // no name starts with _ or . (some hosts refuse those); stable names on request
    T("smallFiles");
    if (!dev) rehashOutputs(r.metafile, { cwd, stable: !!cfg.stableNames || flag("--stable-names") === true });
    T("rehash");
    if (process.env.MARCH_DEBUG_META) writeFileSync(process.env.MARCH_DEBUG_META, JSON.stringify({ meta: r.metafile, plan }));
    const chunks = chunkManifest(r.metafile, { cwd, outdir: out, entry: cfg.entry });
    aliasGroups(chunks.manifest, plan);
    writeHtml(cfg, r.metafile, { dev }, chunks.manifest, dev ? null : chunks.entryFiles);
    T("manifest+html");
    if (cfg.themes !== false) await copyThemes(out, esbuild, { dev });
    T("themes");
    if (!dev && cfg.seo && cfg.seo.prerender !== false) {
      const { prerender } = await import("../compiler/prerender.js");
      const res = await prerender({ cwd, cfg, esbuild, out, importSeo: seoModule });
      T("prerender");
      console.log(`  prerender: ${res.routes.length} page(s)${res.mode === "hash" ? " (hash routing: the start page)" : ""}${res.failed.length ? `, ${res.failed.length} left to the browser` : ""}`);
    }
    if (!dev) {
      if (cfg.headers !== false && !existsSync(join(out, "_headers"))) writeFileSync(join(out, "_headers"), headersFile({ stable: !!cfg.stableNames || flag("--stable-names") === true }));
      // redirects: true → _redirects (Cloudflare Pages, Netlify; files win over it): every address without a file opens the
      // app. An absolute base rewrites to index.html; a relative build's index.html cannot load its files from a deeper
      // address, so it rewrites to 404.html, which hands the address to the app's root (dist/ deployed at the site root)
      if (cfg.redirects && !existsSync(join(out, "_redirects"))) {
        const b = cfg.base ?? "/";
        writeFileSync(join(out, "_redirects"), b.startsWith("/") ? `${b.replace(/\/?$/, "/")}*  ${b.replace(/\/?$/, "/")}index.html  200\n` : "/*  /404.html  200\n");
      }
      if (cfg.sw) writeFileSync(join(out, "sw.js"), swSource({ version: buildVersion(r.metafile), precache: ["./", ...chunks.entryFiles] }));
      const rep = sizeReport(chunks, out, cfg.budget, routePaths(r.metafile, cwd, Object.keys(chunks.manifest)));
      printReport(rep);
      const small = minSize ? smallFiles(r.metafile, { cwd, minSize, allow, entryKey: chunks.entryKey, boot: cfg.budget?.boot ?? [], plan }) : [];
      const files = Object.keys(r.metafile.outputs).filter((k) => /.(js|css)$/.test(k) && existsSync(resolve(cwd, k)));
      const sizes = files.map((k) => readFileSync(resolve(cwd, k)).length);
      const smallest = files.map((k, i) => ({ file: posix(relative(out, resolve(cwd, k))), bytes: sizes[i] })).sort((a, b) => a.bytes - b.bytes)[0] ?? null;
      const chunkStats = { minSize, files: files.length, bytes: sizes.reduce((a, b) => a + b, 0), smallest, under: small.length, allow };
      console.log(`  files: ${chunkStats.files} JS/CSS, ${(chunkStats.bytes / 1024).toFixed(1)} KB; smallest ${smallest ? `${smallest.file} ${(smallest.bytes / 1024).toFixed(1)} KB` : "-"}; under ${(minSize / 1024).toFixed(0)} KB: ${small.length}`);
      writeFileSync(join(out, "march-report.json"), `${JSON.stringify({ chunks: chunkStats, files: fileSizes(out), entry: rep.rows[0], boot: rep.rows.find((x) => x.kind === "boot") ?? null, routes: rep.rows.filter((x) => x.kind === "route").map(({ name, key, js, css, limit, over, files }) => ({ name, key, js, css, limit, over, files })), parts: rep.rows.filter((x) => x.kind === "part" || x.kind === "layout").map(({ name, kind, js, css, limit, over, files }) => ({ name, kind, js, css, limit, over, files })), budget: rep.budget }, null, 2)}\n`);
      if (flag("--analyze") === true) { console.log("  largest modules in the entry (minified, before gzip):"); for (const t of topInputs(r.metafile, cwd, out, chunks.entryFiles, 40)) console.log(`    ${(t.bytes / 1024).toFixed(1).padStart(6)} KB  ${t.file}`); }
      if (small.length) {
        // chunks.allow: { "chunks/x.js": "why it must stay small" } — a reason is required
        console.error(`[31m✖[0m ${small.length} file(s) under chunks.minSize (${minSize} B): ${small.map((x) => `${x.file} ${x.bytes} B`).join(", ")}`);
        process.exitCode = 1;
      }
      if (rep.over.length) {
        const msg = `over budget: ${rep.over.map(overText).join("; ")}`;
        if (rep.over.some((x) => x.entry) && flag("--analyze") !== true) { console.log("  largest modules in the entry (minified, before gzip) — move heavy ones behind import()/lazy():"); for (const t of topInputs(r.metafile, cwd, out, chunks.entryFiles, flag("--analyze") === true ? 40 : 12)) console.log(`    ${(t.bytes / 1024).toFixed(1).padStart(6)} KB  ${t.file}`); }
        if (rep.budget?.fail) { console.error(`\x1b[31m✖\x1b[0m ${msg}`); process.exitCode = 1; } else console.warn(`\x1b[33m!\x1b[0m ${msg}`);
      }
    }
    T("report");
    T.print();
    const bytes = Object.values(r.metafile.outputs).reduce((s, o) => s + o.bytes, 0);
    console.log(`\x1b[32m✔\x1b[0m built ${relative(cwd, out)} in ${Date.now() - t0} ms (${(bytes / 1024).toFixed(1)} KB)`);
    return r;
  } catch (e) {
    for (const er of e.errors ?? [e]) console.error(formatError(er));
    process.exitCode = 1;
  }
}

/**
 * `march build --dev [--watch]`: the fast build for development and checks. One esbuild pass (code splitting on,
 * production semantics, minified), no chunk planning (no 10 KB floor, no entry merge, no packing passes), no prerender;
 * budgets only warn. An esbuild context: `--watch` rebuilds incrementally on every change (unchanged modules come from
 * esbuild's cache and the March compile cache, so a rebuild takes milliseconds). The release build is `march build`
 * (= `march build --release`).
 */
async function buildDev({ watch: watching = false } = {}) {
  const T = timer();
  const cfg = await loadConfig();
  const esbuild = await loadEsbuild();
  const out = resolve(cwd, cfg.outdir);
  const pages = existsSync(resolve(cwd, cfg.pagesDir)) ? resolve(cwd, cfg.pagesDir) : null;
  if (pages) genRoutes(pages, resolve(cwd, "src/routes.gen.js"));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  if (existsSync(resolve(cwd, cfg.publicDir))) cpSync(resolve(cwd, cfg.publicDir), out, { recursive: true });
  if (cfg.themes !== false) await copyThemes(out, esbuild, { dev: true });
  T("setup");
  const opts = buildOptions(cfg, esbuild, { dev: false });
  opts.entryNames = "[name]";
  // no rename pass here (the release build's rehashOutputs): a chunk named after src/pages/_layout.tsx must still not
  // start with _ or . (publishing hosts refuse those)
  opts.chunkNames = "chunks/c-[name]-[hash]";
  // outputs stay in memory (the CSS split and import pruning rewrite them there); only files whose bytes changed since
  // the previous build are written — a rebuild touches a handful of files instead of all of them
  opts.write = false;
  const written = new Map(); // abs path → bytes last written
  const flush = (files) => {
    const now = new Set();
    for (const f of files) {
      now.add(f.path);
      const prev = written.get(f.path);
      if (prev && Buffer.compare(prev, f.contents) === 0) continue;
      mkdirSync(dirname(f.path), { recursive: true });
      writeFileSync(f.path, f.contents);
      written.set(f.path, Buffer.from(f.contents));
    }
    // files of the previous build that this one no longer has (new content hash → new name)
    for (const p of [...written.keys()]) if (!now.has(p)) { rmSync(p, { force: true }); written.delete(p); }
  };
  let first = true, started = 0;
  opts.plugins.push({ name: "march-dev-build", setup(b) {
    b.onStart(() => { started = performance.now(); if (pages && !first) genRoutes(pages, resolve(cwd, "src/routes.gen.js")); });
    b.onEnd((r) => {
      if (r.errors.length) { r.errors.forEach((e) => console.error(formatError(e))); if (!watching) process.exitCode = 1; return; }
      flush(r.outputFiles ?? []);
      const chunks = chunkManifest(r.metafile, { cwd, outdir: out, entry: cfg.entry });
      writeHtml(cfg, r.metafile, { dev: false }, chunks.manifest, chunks.entryFiles);
      if (cfg.sw) writeFileSync(join(out, "sw.js"), swSource({ version: buildVersion(r.metafile), precache: ["./", ...chunks.entryFiles] }));
      // budgets: a warning (the release build enforces them on the planned chunks; these unplanned ones are only a hint)
      // (watch: only after the first build — gzip of every file would double each rebuild; --budget for every rebuild)
      if (cfg.budget && flag("--no-budget") !== true && (first || flag("--budget") === true)) {
        const rep = sizeReport(chunks, out, cfg.budget, routePaths(r.metafile, cwd, Object.keys(chunks.manifest)));
        if (rep.over.length) console.warn(`[33m![0m over budget (dev build, unplanned chunks — the release build decides): ${rep.over.length} row(s); first: ${overText(rep.over[0])}`);
      }
      const bytes = Object.values(r.metafile.outputs).reduce((s, o) => s + o.bytes, 0);
      console.log(`[32m✔[0m ${first ? "built" : "rebuilt"} ${relative(cwd, out)} (dev) in ${Math.round(performance.now() - started)} ms (${Object.keys(r.metafile.outputs).length} files, ${(bytes / 1024).toFixed(1)} KB)`);
      first = false;
    });
  } });
  const ctx = await esbuild.context(opts);
  T("context");
  const r = await ctx.rebuild().catch((e) => ({ errors: e.errors ?? [e] }));
  T("esbuild+html");
  if (!watching) {
    await ctx.dispose();
    if (r.errors?.length) process.exitCode = 1;
    T.print();
    return r;
  }
  if (existsSync(resolve(cwd, cfg.publicDir))) watch(resolve(cwd, cfg.publicDir), { recursive: true }, () => cpSync(resolve(cwd, cfg.publicDir), out, { recursive: true }));
  await ctx.watch();
  console.log("watching for changes (Ctrl+C to stop)");
}

function formatError(er) {
  const loc = er.location ? `${er.location.file}:${er.location.line}:${er.location.column + 1}\n  ${er.location.lineText}\n` : "";
  return `\x1b[31m✖ ${er.text ?? er.message}\x1b[0m\n${loc}${er.detail && typeof er.detail === "string" ? er.detail : ""}`;
}

async function dev() {
  const cfg = await loadConfig();
  const esbuild = await loadEsbuild();
  const port = Number(flag("--port", cfg.port));
  const out = resolve(cwd, cfg.outdir);
  const mockSpec = flag("--mock");
  const mock = typeof mockSpec === "string" ? mockHandler(JSON.parse(readFileSync(resolve(cwd, mockSpec), "utf8"))) : null;
  const clients = new Set();
  let lastErrors = [];
  const send = (ev, data) => { for (const c of clients) c.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); };

  const opts = buildOptions(cfg, esbuild, { dev: true });
  // --mock: the app may switch to hadi-march/net's in-browser mock (`if (mockRequested()) net.mock(handlers)`)
  if (mockSpec) opts.define = { ...opts.define, "globalThis.MARCH_MOCK": "true" };
  opts.plugins.push({ name: "march-dev", setup(b) {
    b.onStart(() => { if (existsSync(resolve(cwd, cfg.pagesDir))) genRoutes(resolve(cwd, cfg.pagesDir), resolve(cwd, "src/routes.gen.js")); });
    b.onEnd((r) => {
      lastErrors = r.errors.map((e) => ({ text: e.text, file: e.location?.file, line: e.location?.line, column: e.location?.column, lineText: e.location?.lineText, detail: typeof e.detail === "string" ? e.detail : "" }));
      if (r.errors.length) { r.errors.forEach((e) => console.error(formatError(e))); send("build-error", lastErrors); return; }
      try { writeHtml(cfg, r.metafile, { dev: true }, chunkManifest(r.metafile, { cwd, outdir: out, entry: cfg.entry }).manifest); } catch { /* first build */ }
      console.log(`\x1b[32m✔\x1b[0m rebuilt`);
      send("reload", {});
    });
  } });
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  if (existsSync(resolve(cwd, cfg.publicDir))) cpSync(resolve(cwd, cfg.publicDir), out, { recursive: true });
  if (cfg.themes !== false) await copyThemes(out, esbuild, { dev: true });
  const ctx = await esbuild.context(opts);
  await ctx.watch();

  const client = (cfg.banner === false ? "" : bannerSource(marchVersion(), "Dev server: live reload on; errors show as an overlay. Turn this line off with banner: false in march.config.js.")) + readFileSync(join(MARCH_ROOT, "cli", "dev-client.js"), "utf8");
  createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/__march/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      clients.add(res);
      if (lastErrors.length) res.write(`event: build-error\ndata: ${JSON.stringify(lastErrors)}\n\n`);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (url.pathname === "/__march/client.js") { res.writeHead(200, { "content-type": "text/javascript" }); res.end(client); return; }
    if (mock && url.pathname.startsWith(mock.base)) return mock.handle(req, res, url);
    let file = join(out, decodeURIComponent(url.pathname));
    if (!file.startsWith(out)) { res.writeHead(400).end(); return; }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(out, "index.html");
    const type = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".map": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" }[extname(file)] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(readFileSync(file));
  }).listen(port, "127.0.0.1", () => console.log(`March dev server: http://127.0.0.1:${port}/${mock ? `  (mock API at ${mock.base})` : ""}`));
  if (existsSync(resolve(cwd, cfg.publicDir))) watch(resolve(cwd, cfg.publicDir), { recursive: true }, () => { cpSync(resolve(cwd, cfg.publicDir), out, { recursive: true }); send("reload", {}); });
}

async function gen() {
  const [what, name] = argv.slice(1);
  const cfg = await loadConfig();
  const put = (file, content) => {
    const p = resolve(cwd, file);
    if (existsSync(p)) fail(`${file} already exists`);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
    console.log(`\x1b[32m+\x1b[0m ${file}`);
  };
  if (what === "routes") { genRoutes(resolve(cwd, cfg.pagesDir), resolve(cwd, "src/routes.gen.js")); console.log("routes generated"); return; }
  if (!name && what !== "api") fail(`usage: march gen ${what ?? "page|component|crud|routes|api"} <name>`);
  if (what === "page") return put(join(cfg.pagesDir, `${name}.jsx`), templates.page(name));
  if (what === "component" && isLibrary()) return libComponent(name, put);
  if (what === "component") return put(join(cfg.components, `${name}.jsx`), templates.component(name));
  if (what === "crud") return put(join(cfg.pagesDir, `${name}.jsx`), templates.crud(name));
  if (what === "api") {
    const spec = argv[2] ?? fail("usage: march gen api openapi.json");
    const classes = !!flag("--classes");
    const outFile = flag("--out", classes ? "src/api.gen.ts" : "src/api.gen.js");
    const doc = JSON.parse(readFileSync(resolve(cwd, spec), "utf8"));
    writeFileSync(resolve(cwd, outFile), classes ? genApiClasses(doc) : genApi(doc));
    console.log(`\x1b[32m✔\x1b[0m ${outFile}`);
    return;
  }
  fail(`unknown generator "${what}"`);
}

async function i18n() {
  const r = await build({ dev: true });
  if (!r) return;
  const cfg = await loadConfig();
  const keys = JSON.parse(readFileSync(resolve(cwd, cfg.outdir, "i18n-keys.json"), "utf8"));
  const dir = resolve(cwd, flag("--messages", "src/i18n"));
  if (!existsSync(dir)) { console.log(`${keys.length} keys; no messages dir (${relative(cwd, dir)})`); return; }
  let missing = 0;
  for (const f of readdirSync(dir).filter((x) => /\.(json|js)$/.test(x))) {
    const dict = f.endsWith(".json") ? JSON.parse(readFileSync(join(dir, f), "utf8")) : (await import(pathToFileURL(join(dir, f)).href)).default;
    const miss = keys.filter((k) => !(k in dict));
    missing += miss.length;
    console.log(`${basename(f)}: ${miss.length ? `\x1b[33m${miss.length} missing\x1b[0m` : "\x1b[32mcomplete\x1b[0m"}`);
    for (const k of miss.slice(0, 50)) console.log(`  - ${k}`);
  }
  if (missing) process.exitCode = 1;
}

/** Inside the hadi-march repository: `march gen component` makes a component folder, `march check component` checks one. */
function isLibrary() {
  try { return JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8")).name === "hadi-march" && existsSync(resolve(cwd, "src/components")); } catch { return false; }
}
async function libComponent(name, put) {
  const folder = name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  const Name = folder.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  const { CATEGORIES } = await import(pathToFileURL(resolve(cwd, "src/components/categories.ts")).href);
  const ids = CATEGORIES.map((c) => c.id);
  const category = flag("--category");
  if (typeof category !== "string" || !ids.includes(category)) fail(`usage: march gen component ${Name} --category <${ids.join("|")}> [--parts A,B]`);
  const parts = typeof flag("--parts") === "string" ? flag("--parts").split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (category === "composite" && !parts.length) fail("a composite component is built from others: --parts Button,Menu …");
  const { libComponent: files } = await import("./lib-templates.js");
  for (const [f, text] of Object.entries(files(folder, Name, category, parts))) put(join("src/components", category, folder, f), text);
  const { spawnSync } = await import("node:child_process");
  spawnSync(process.execPath, ["--import", pathToFileURL(resolve(cwd, "compiler/register.js")).href, resolve(cwd, "tools/gen-registry.js")], { cwd, stdio: "inherit" });
  console.log(`next: march check component ${category}/${folder}  (checklist: docs/component-checklist.md)`);
}

async function typecheck() {
  if (argv[1] === "component") {
    const name = argv[2] ?? fail("usage: march check component <name>");
    const { checkComponent, printCheck } = await import("./check-component.js");
    const r = await checkComponent(cwd, name);
    printCheck(name, r);
    if (!r.ok) process.exitCode = 1;
    return;
  }
  const { check } = await import("./check.js");
  const cfg = await loadConfig();
  const n = await check({ components: cfg.components, srcDir: flag("--src", "src") });
  if (n) process.exitCode = 1;
}

/** hadi-march/seo (TypeScript; also when March is installed under node_modules). */
async function seoModule() {
  const { importTs } = await import("../compiler/load-ts.js");
  return importTs(new URL("../src/seo/index.ts", import.meta.url));
}

async function seo() {
  if (argv[1] !== "check") fail("usage: march seo check [--dir dist] [--no-canonical]");
  const cfg = await loadConfig();
  const dir = resolve(cwd, flag("--dir", cfg.outdir));
  if (!existsSync(dir)) fail(`${relative(cwd, dir) || dir} does not exist: run march build first`);
  const { importTs } = await import("../compiler/load-ts.js");
  const { checkHtml, formatIssues } = await importTs(new URL("../src/seo/check.ts", import.meta.url));
  const walkHtml = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walkHtml(p) : n.endsWith(".html") ? [p] : []; });
  let errors = 0, warns = 0;
  // pages that ask not to be indexed (404.html, the not-found fallback) are not search results: nothing to check
  const files = walkHtml(dir).filter((f) => !/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(readFileSync(f, "utf8")));
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    // hash routing: every route is the same document, a canonical link is optional
    const canonical = flag("--no-canonical") === true ? false : !/data-hm-prerender="#/.test(html) && !!cfg.seo?.site;
    const issues = checkHtml(html, { canonical });
    errors += issues.filter((i) => i.level === "error").length;
    warns += issues.filter((i) => i.level === "warn").length;
    if (issues.length) console.log(formatIssues(posix(relative(cwd, f)), issues));
  }
  console.log(`${errors ? "\x1b[31m✖\x1b[0m" : "\x1b[32m✔\x1b[0m"} ${files.length} page(s): ${errors} error(s), ${warns} warning(s)`);
  if (errors) process.exitCode = 1;
}

const cmd = argv[0];
const icons = async () => (await import("./icons.js")).main(argv.slice(1));
// `march build` and `march build --release`: the release build (chunk planning, 10 KB floor, budgets, prerender).
// `march build --dev [--watch]`: the fast build (buildDev).
const run = { dev, build: () => (flag("--dev") === true || flag("--watch") === true ? buildDev({ watch: flag("--watch") === true }) : build()), gen, i18n, check: typecheck, seo, icons }[cmd];
if (!run) {
  console.log("HADI March\n  march dev [--port 5173] [--mock openapi.json]\n  march build [--no-minify]\n  march gen routes|page|component|crud|api <name>\n  march i18n [--messages src/i18n]\n  march check [--src src]   (type-check, full March syntax)\n  march check component <name>   (in the hadi-march repo: the component checklist)\n  march seo check [--dir dist]   (titles, descriptions, canonical, img alt)\n  march icons list | add <pack…|all> | gallery <dir>   (open-source icon sets as icon packs)");
  process.exit(cmd ? 1 : 0);
}
await run();
