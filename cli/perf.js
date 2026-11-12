// Build-time performance helpers for `march build`:
//   chunkManifest  source key of every dynamic import → all files it needs (JS chunks + CSS), minus what the entry has
//   sizeReport     gzip size of the entry and of each lazy route, checked against march.config.js › budget
//   headersFile    a Netlify / Cloudflare Pages `_headers` file: hashed assets immutable, the page always revalidated
//   swSource       the optional service worker (march.config.js › sw: true)
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { dirname, relative, resolve, sep, join } from "node:path";
import { posix } from "../compiler/fs-util.js";


/**
 * @param {import("esbuild").Metafile} meta
 * @param {{ cwd: string, outdir: string, entry: string }} o  absolute cwd, absolute outdir, entry file (as configured)
 * @returns {{ manifest: Record<string, string[]>, entryFiles: string[], entryKey: string|null }}
 */
export function chunkManifest(meta, { cwd, outdir, entry }) {
  const outs = meta.outputs;
  const want = resolve(cwd, entry);
  const entryKey = Object.keys(outs).find((k) => outs[k].entryPoint && resolve(cwd, outs[k].entryPoint) === want) ?? null;
  const closure = (key, seen = new Set()) => {
    if (!outs[key] || seen.has(key)) return seen;
    seen.add(key);
    for (const c of outs[key].cssBundles ?? (outs[key].cssBundle ? [outs[key].cssBundle] : [])) seen.add(c);
    for (const im of outs[key].imports ?? []) if (im.kind === "import-statement" && !im.external) closure(im.path, seen);
    return seen;
  };
  // with stable names the version travels as a query (the same URL the chunks import, so a preload is reused)
  const rel = (k) => posix(relative(outdir, resolve(cwd, k))) + (outs[k]?.version ? `?v=${outs[k].version}` : "");
  const base = entryKey ? closure(entryKey) : new Set();
  const manifest = {};
  for (const [k, o] of Object.entries(outs)) {
    if (!o.entryPoint || k === entryKey || !k.endsWith(".js")) continue;
    const files = [...closure(k)].filter((f) => !base.has(f));
    // own chunk first, then its JS dependencies, CSS last
    files.sort((a, b) => (a === k ? -1 : b === k ? 1 : Number(a.endsWith(".css")) - Number(b.endsWith(".css"))));
    manifest[posix(o.entryPoint)] = files.map(rel);
  }
  // the shared "common" chunks (pack-chunks.js) outside start-up: the router prefetches them when idle
  const common = Object.keys(outs).filter((k) => outs[k].common && k.endsWith(".js"));
  if (common.length) manifest["march:common"] = [...new Set(common.flatMap((k) => [...closure(k)]))].filter((f) => !base.has(f)).sort((a, b) => Number(a.endsWith(".css")) - Number(b.endsWith(".css"))).map(rel);
  return { manifest, entryFiles: [...base].map(rel), entryKey };
}

const gz = (file) => { file = file.replace(/\?.*$/, ""); return existsSync(file) ? gzipSync(readFileSync(file)).length : 0; };

/**
 * Route paths of lazy pages, read from the app's own sources: `"/x": () => import("./pages/x.tsx")` and
 * `"/x": { load: () => import(…) }` (what `march gen routes` writes). Returns manifest key → route path.
 * @param {import("esbuild").Metafile} meta
 * @param {string} cwd
 * @param {string[]} keys  manifest keys (dynamic import sources, relative to cwd)
 */
export function routePaths(meta, cwd, keys) {
  const RE = /["'`](\/[^"'`]*)["'`]\s*:\s*(?:\{\s*load\s*:\s*)?\(\)\s*=>\s*import\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  const strip = (k) => k.replace(/\.[cm]?[jt]sx?$/, "");
  const byBase = new Map(keys.map((k) => [strip(k), k]));
  const out = {};
  for (const inp of Object.keys(meta.inputs)) {
    if (inp.includes("node_modules") || inp.startsWith("..") || !/\.[cm]?[jt]sx?$/.test(inp)) continue;
    const file = resolve(cwd, inp);
    if (!existsSync(file)) continue;
    for (const [, path, spec] of readFileSync(file, "utf8").matchAll(RE)) {
      if (!spec.startsWith(".")) continue;
      const key = byBase.get(strip(posix(relative(cwd, resolve(dirname(file), spec)))));
      if (key && !(key in out)) out[key] = path;
    }
  }
  return out;
}

/**
 * One row per download unit: the entry, each route (named by its path when known) and each lazy part (a lazy()
 * component, a lazily loaded shell piece, a locale pack). Budgets are gzip bytes of JavaScript; CSS is reported, and
 * checked too when `css` is set.
 * @param {{ manifest: Record<string,string[]>, entryFiles: string[] }} m
 * @param {string} outdir
 * @param {{ entry?: number, route?: number, part?: number, css?: number, routes?: Record<string, number>, fail?: boolean } | false | undefined} budget
 * @param {Record<string, string>} [routes]  manifest key → route path (routePaths())
 */
/** A layout module (march gen routes: _layout.tsx): it ships with its routes, so it has the route budget. */
const LAYOUT = /(^|\/)_?layout\.[cm]?[jt]sx?$/;
export function sizeReport(m, outdir, budget, routes = {}) {
  const size = (files) => {
    let js = 0, css = 0;
    for (const f of files) { const n = gz(resolve(outdir, f)); if (/\.css(\?|$)/.test(f)) css += n; else js += n; }
    return { js, css };
  };
  // budget.boot: lazy parts the app loads at start-up (shell pieces); a route row then counts only what ITS navigation
  // downloads (their files are already there). The boot row shows what start-up costs beyond the entry.
  const bootKeys = (budget && budget.boot) || [];
  const bootFiles = new Set(bootKeys.flatMap((k) => m.manifest[k] ?? []));
  const rows = [{ name: "(entry)", key: null, kind: "entry", files: m.entryFiles, ...size(m.entryFiles), entry: true }];
  if (bootFiles.size) rows.push({ name: "(boot)", key: null, kind: "boot", files: [...bootFiles], ...size([...bootFiles]), entry: false });
  // a group chunk shows as its members (each route row)
  const rest = Object.entries(m.manifest).filter(([k]) => !bootKeys.includes(k) && !k.startsWith("march-group:")).map(([k, all]) => ({ files: all.filter((f) => !bootFiles.has(f)), k })).map(({ k, files }) => ({ name: routes[k] ?? k, key: k, kind: routes[k] ? "route" : LAYOUT.test(k) ? "layout" : "part", files, ...size(files), entry: false }));
  // routes by path, then the lazy parts by name
  const RANK = { route: 0, layout: 1, part: 2 };
  rest.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : RANK[a.kind] - RANK[b.kind]));
  rows.push(...rest);
  const b = budget === false ? null : { entry: 15 * 1024, route: 60 * 1024, fail: false, ...(budget ?? {}) };
  const over = [];
  for (const r of rows) {
    r.limit = !b ? Infinity : r.kind === "entry" ? b.entry : r.kind === "boot" ? b.bootLimit ?? b.route : r.kind === "route" ? b.routes?.[r.name] ?? b.route : r.kind === "layout" ? b.route : b.part ?? b.route;
    r.cssLimit = b?.css ?? Infinity;
    r.over = r.js > r.limit || r.css > r.cssLimit;
    if (r.over) over.push(r);
  }
  return { rows, over, budget: b };
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
/** Why a row is over budget: "/data JS 62.1 KB > 60.0 KB". */
export const overText = (r) => [r.js > r.limit ? `${r.name} JS ${kb(r.js)} > ${kb(r.limit)}` : "", r.css > r.cssLimit ? `${r.name} CSS ${kb(r.css)} > ${kb(r.cssLimit)}` : ""].filter(Boolean).join(", ");

export function printReport(rep, log = console.log) {
  log("  size (gzip)                                  kind      JS        CSS     budget");
  for (const r of rep.rows) {
    const lim = Number.isFinite(r.limit) ? kb(r.limit) : "—";
    log(`  ${r.over ? "\x1b[33m!" : " "} ${r.name.padEnd(42).slice(0, 42)} ${r.kind.padEnd(6)} ${kb(r.js).padStart(8)}  ${kb(r.css).padStart(8)}  ${lim.padStart(8)}${r.over ? "  over budget\x1b[0m" : ""}`);
  }
  if (rep.budget) log(`  budget: entry JS ≤ ${kb(rep.budget.entry)}, route JS ≤ ${kb(rep.budget.route)}, part JS ≤ ${kb(rep.budget.part ?? rep.budget.route)}${rep.budget.css ? `, CSS ≤ ${kb(rep.budget.css)}` : ""}${rep.budget.routes ? ` (+${Object.keys(rep.budget.routes).length} per-route)` : ""} (march.config.js › budget)`);
}

/** `_headers` for static hosts: hashed files are cached forever, the HTML and the service worker are revalidated. */
export function headersFile({ stable = false } = {}) {
  return [
    // stable names: the same path gets new bytes on a deploy, so caches revalidate (the ?v= query still busts them)
    "/assets/*", stable ? "  Cache-Control: public, max-age=0, must-revalidate" : "  Cache-Control: public, max-age=31536000, immutable", "",
    "/themes/*", "  Cache-Control: public, max-age=86400, stale-while-revalidate=604800", "",
    "/", "  Cache-Control: no-cache", "",
    "/index.html", "  Cache-Control: no-cache", "",
    "/sw.js", "  Cache-Control: no-cache", "  Service-Worker-Allowed: /", "",
  ].join("\n");
}

/** A short build version: changes whenever any output file changes. */
export function buildVersion(meta) {
  const h = createHash("sha256");
  for (const k of Object.keys(meta.outputs).sort()) h.update(`${k}:${meta.outputs[k].bytes}\n`);
  return h.digest("hex").slice(0, 12);
}

/**
 * The service worker. Strategy:
 *   - install: precache the page and the entry's files (second visit opens without the network)
 *   - hashed assets (assets/): cache-first, stored the first time they arrive (route chunks too)
 *   - navigations: network-first, falling back to the cached page (offline)
 *   - activate: delete the caches of other versions; the page decides when to switch (applyUpdate())
 * @param {{ version: string, precache: string[] }} o  precache paths are relative to the service worker's folder
 */
export function swSource({ version, precache }) {
  return `// HADI March service worker (generated by march build). Version ${version}.
const VERSION = ${JSON.stringify(version)};
const CACHE = "march-" + VERSION;
const PRECACHE = ${JSON.stringify(precache)};
const scope = self.registration ? self.registration.scope : self.location.href.replace(/[^/]*$/, "");
const abs = (p) => new URL(p, scope).href;
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map(abs))));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("march-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => {
  if (e.data === "march:skip-waiting") self.skipWaiting();
  if (e.data === "march:version" && e.source) e.source.postMessage({ type: "march:version", version: VERSION });
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(abs("./"), copy)); }
      return res;
    }).catch(() => caches.match(abs("./")).then((r) => r || caches.match(abs("index.html"))).then((r) => r || Response.error())));
    return;
  }
  if (!url.href.startsWith(abs("assets/")) && !url.href.startsWith(abs("themes/"))) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) c.put(req, res.clone());
    return res;
  }))));
});
`;
}

/**
 * Which source files make up a set of output files (largest first): printed when the entry is over budget, so the fix
 * (move a heavy import behind import() or lazy()) is obvious.
 */
export function topInputs(meta, cwd, outdir, files, n = 12) {
  const want = new Set(files.map((f) => posix(relative(cwd, resolve(outdir, f.replace(/\?.*$/, ""))))));
  const by = new Map();
  for (const [k, o] of Object.entries(meta.outputs)) {
    if (!want.has(posix(k)) || !k.endsWith(".js")) continue;
    for (const [inp, v] of Object.entries(o.inputs)) by.set(inp, (by.get(inp) ?? 0) + v.bytesInOutput);
  }
  return [...by].sort((a, b) => b[1] - a[1]).slice(0, n).map(([file, bytes]) => ({ file, bytes }));
}

/**
 * Every served JS / CSS / font file under `outdir` with its raw and gzip size, keyed by its path relative to `outdir`
 * (no `?v=`). Written to march-report.json › files: the Speed page falls back to it when the browser cannot measure a
 * response (cross-origin without Timing-Allow-Origin: transferSize is only the headers, body sizes are 0).
 * @param {string} outdir
 * @returns {Record<string, { raw: number, gzip: number }>}
 */
export function fileSizes(outdir) {
  const out = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(js|css|woff2?)$/.test(name)) continue;
      const buf = readFileSync(p);
      out[relative(outdir, p).split(sep).join("/")] = { raw: buf.length, gzip: /\.woff2?$/.test(name) ? buf.length : gzipSync(buf).length };
    }
  };
  if (existsSync(outdir)) walk(outdir);
  return out;
}
