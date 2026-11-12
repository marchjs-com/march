#!/usr/bin/env node
// HADI March CLI
//   march dev [--port 5173] [--mock [openapi.json]]  dev server: rebuild on change, live reload, error overlay, optional mock API
//                                                    (--mock also sets globalThis.MARCH_MOCK for net.mock in the app)
//   march build [--outdir dist] [--no-minify]        production bundle (code splitting, hashed chunks, public/ copied)
//   march gen routes                                 src/pages/** → src/routes.gen.js (+ pages.d.ts param types)
//   march gen page users/[id] | gen component Name | gen crud products
//   march gen api openapi.json [--out src/api.gen.js] typed client + schemas from an OpenAPI 3 document
//                 [--classes]                       hadi-march/net Api classes + interfaces instead (src/api.gen.ts)
//   march i18n [--messages src/i18n]                 report keys missing from translation files
//   march check [--src src]                          type-check .tsx/.ts including March syntax (pipes, modifiers…)
//   march seo check [--dir dist] [--no-canonical]    built pages: missing title / description / canonical / img alt…
// Config (optional): march.config.js exporting { entry, outdir, publicDir, pagesDir, components, alias, define, port, html,
//   base: "/" | "./" (asset URLs in index.html; "./" = works from any sub-folder), stableNames: true (or --stable-names:
//   main.js, chunks/home.js… with ?v=<version> in every reference; deploys overwrite the same paths), packChunks: false,
//   budget: { entry, route, part, css, routes: { "/x": bytes }, fail } (gzip bytes; false = off), sw: true (offline service worker), headers: false (no _headers),
//   credit: true (adds <!-- Built with HADI March --> to the built index.html and prints the one-line console banner in production too; off by default),
//   banner: false (no console banner in `march dev`; production never prints one unless credit is on) }.
//   seo: { site, prerender: true | ["/a"], sitemap, robots, head } (compiler/prerender.js: static HTML per route + sitemap.xml/robots.txt) }.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, cpSync, rmSync, watch } from "node:fs";
import { join, resolve, relative, dirname, extname, basename, sep } from "node:path";
const posix = (p) => p.split(sep).join("/");
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { march } from "../compiler/esbuild.js";
import { genRoutes } from "./routes.js";
import { genApi, genApiClasses, mockHandler } from "./openapi.js";
import { bannerSource } from "./banner.js";
import { templates } from "./templates.js";
import { mergeEntry, rehashOutputs } from "../compiler/merge-entry.js";
import { packChunks } from "../compiler/pack-chunks.js";
import { planSmallLazy, smallFiles, aliasGroups } from "../compiler/min-chunks.js";
import { chunkManifest, sizeReport, printReport, headersFile, swSource, buildVersion, topInputs, routePaths, overText, fileSizes } from "./perf.js";

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
    plugins: [march({ components: resolve(cwd, cfg.components), dev, i18nOut: resolve(cwd, cfg.outdir, "i18n-keys.json"), ...(plan ? { inline: plan.inline, groups: plan.groups } : {}) })],
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
  const tags = `${cfg.credit === true ? "<!-- Built with HADI March -->" : ""}${css ? `<link rel="stylesheet" href="${css}">` : ""}${data}${pre}<script type="module" src="${js}"></script>${dev ? '<script type="module" src="/__march/client.js"></script>' : cfg.credit === true ? `<script src="${base}credit.js"></script>` : ""}`;
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

async function build({ dev = false } = {}) {
  const cfg = await loadConfig();
  const esbuild = await loadEsbuild();
  if (existsSync(resolve(cwd, cfg.pagesDir))) genRoutes(resolve(cwd, cfg.pagesDir), resolve(cwd, "src/routes.gen.js"));
  const out = resolve(cwd, cfg.outdir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  if (existsSync(resolve(cwd, cfg.publicDir))) cpSync(resolve(cwd, cfg.publicDir), out, { recursive: true });
  const t0 = Date.now();
  try {
    // chunks.minSize: no output file under it (default 10 KB before gzip); small lazy modules need a second pass
    const minSize = cfg.chunks === false ? 0 : cfg.chunks?.minSize ?? cfg.packChunks?.minSize ?? 10240;
    const allow = (cfg.chunks && cfg.chunks.allow) || {};
    let plan = null, r;
    for (let pass = 0; pass < 4; pass++) {
      if (pass) rmSync(resolve(out, "assets"), { recursive: true, force: true });
      r = await esbuild.build(buildOptions(cfg, esbuild, { dev, plan }));
      // production: the entry and its static chunks become one file (fewer requests, better compression)
      if (dev || cfg.mergeEntry === false) break;
      const want = resolve(cwd, cfg.entry);
      const entryKey = Object.keys(r.metafile.outputs).find((k) => r.metafile.outputs[k].entryPoint && resolve(cwd, r.metafile.outputs[k].entryPoint) === want);
      if (!entryKey) break;
      const minify = flag("--no-minify") !== true;
      await mergeEntry(r.metafile, { cwd, entryKey, esbuild, minify });
      // small shared chunks fold into a chunk loaded with them, else the cheapest partner; off with packChunks: false
      if (cfg.packChunks !== false) await packChunks(r.metafile, { cwd, entryKey, esbuild, minify, minSize: minSize || 2048 });
      const next = minSize ? planSmallLazy(r.metafile, { cwd, entryKey, minSize, allow, boot: cfg.budget?.boot ?? [], prev: plan }) : null;
      if (!next) break;
      plan = next;
    }
    // final names: every rewritten file gets a new content version (a cached file must never point at another build),
    // no name starts with _ or . (some hosts refuse those); stable names on request
    if (!dev) rehashOutputs(r.metafile, { cwd, stable: !!cfg.stableNames || flag("--stable-names") === true });
    const chunks = chunkManifest(r.metafile, { cwd, outdir: out, entry: cfg.entry });
    aliasGroups(chunks.manifest, plan);
    writeHtml(cfg, r.metafile, { dev }, chunks.manifest, dev ? null : chunks.entryFiles);
    if (cfg.themes !== false) await copyThemes(out, esbuild, { dev });
    if (!dev && cfg.seo && cfg.seo.prerender !== false) {
      const { prerender } = await import("../compiler/prerender.js");
      const res = await prerender({ cwd, cfg, esbuild, out, importSeo: seoModule });
      console.log(`  prerender: ${res.routes.length} page(s)${res.mode === "hash" ? " (hash routing: the start page)" : ""}${res.failed.length ? `, ${res.failed.length} left to the browser` : ""}`);
    }
    if (!dev) {
      if (cfg.headers !== false && !existsSync(join(out, "_headers"))) writeFileSync(join(out, "_headers"), headersFile({ stable: !!cfg.stableNames || flag("--stable-names") === true }));
      if (cfg.sw) writeFileSync(join(out, "sw.js"), swSource({ version: buildVersion(r.metafile), precache: ["./", ...chunks.entryFiles] }));
      const rep = sizeReport(chunks, out, cfg.budget, routePaths(r.metafile, cwd, Object.keys(chunks.manifest)));
      printReport(rep);
      const small = minSize ? smallFiles(r.metafile, { cwd, minSize, allow, entryKey: chunks.entryKey, boot: cfg.budget?.boot ?? [], plan }) : [];
      const files = Object.keys(r.metafile.outputs).filter((k) => /.(js|css)$/.test(k) && existsSync(resolve(cwd, k)));
      const sizes = files.map((k) => readFileSync(resolve(cwd, k)).length);
      const smallest = files.map((k, i) => ({ file: posix(relative(out, resolve(cwd, k))), bytes: sizes[i] })).sort((a, b) => a.bytes - b.bytes)[0] ?? null;
      const chunkStats = { minSize, files: files.length, bytes: sizes.reduce((a, b) => a + b, 0), smallest, under: small.length, allow };
      console.log(`  files: ${chunkStats.files} JS/CSS, ${(chunkStats.bytes / 1024).toFixed(1)} KB; smallest ${smallest ? `${smallest.file} ${(smallest.bytes / 1024).toFixed(1)} KB` : "-"}; under ${(minSize / 1024).toFixed(0)} KB: ${small.length}`);
      writeFileSync(join(out, "march-report.json"), `${JSON.stringify({ chunks: chunkStats, files: fileSizes(out), entry: rep.rows[0], routes: rep.rows.filter((x) => x.kind === "route").map(({ name, key, js, css, limit, over, files }) => ({ name, key, js, css, limit, over, files })), parts: rep.rows.filter((x) => x.kind === "part" || x.kind === "layout").map(({ name, kind, js, css, limit, over, files }) => ({ name, kind, js, css, limit, over, files })), budget: rep.budget }, null, 2)}\n`);
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
    const bytes = Object.values(r.metafile.outputs).reduce((s, o) => s + o.bytes, 0);
    console.log(`\x1b[32m✔\x1b[0m built ${relative(cwd, out)} in ${Date.now() - t0} ms (${(bytes / 1024).toFixed(1)} KB)`);
    return r;
  } catch (e) {
    for (const er of e.errors ?? [e]) console.error(formatError(er));
    process.exitCode = 1;
  }
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
  const { libComponent: files } = await import("./lib-templates.js");
  for (const [f, text] of Object.entries(files(folder, Name))) put(join("src/components", folder, f), text);
  const { spawnSync } = await import("node:child_process");
  spawnSync(process.execPath, [resolve(cwd, "tools/gen-registry.js")], { cwd, stdio: "inherit" });
  console.log(`next: march check component ${folder}  (checklist: docs/component-checklist.md)`);
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
  const files = walkHtml(dir);
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
const run = { dev, build: () => build(), gen, i18n, check: typecheck, seo }[cmd];
if (!run) {
  console.log("HADI March\n  march dev [--port 5173] [--mock openapi.json]\n  march build [--no-minify]\n  march gen routes|page|component|crud|api <name>\n  march i18n [--messages src/i18n]\n  march check [--src src]   (type-check, full March syntax)\n  march check component <name>   (in the hadi-march repo: the component checklist)\n  march seo check [--dir dist]   (titles, descriptions, canonical, img alt)");
  process.exit(cmd ? 1 : 0);
}
await run();
