// Build-time performance helpers for `march build`:
//   chunkManifest  source key of every dynamic import → all files it needs (JS chunks + CSS), minus what the entry has
//   sizeReport     gzip size of the entry and of each lazy route, checked against march.config.js › budget
//   headersFile    a Netlify / Cloudflare Pages `_headers` file: hashed assets immutable, the page always revalidated
//   swSource       the optional service worker (march.config.js › sw: true)
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { relative, resolve, sep } from "node:path";

const posix = (p) => p.split(sep).join("/");

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
    if (outs[key].cssBundle) seen.add(outs[key].cssBundle);
    for (const im of outs[key].imports ?? []) if (im.kind === "import-statement" && !im.external) closure(im.path, seen);
    return seen;
  };
  const rel = (k) => posix(relative(outdir, resolve(cwd, k)));
  const base = entryKey ? closure(entryKey) : new Set();
  const manifest = {};
  for (const [k, o] of Object.entries(outs)) {
    if (!o.entryPoint || k === entryKey || !k.endsWith(".js")) continue;
    const files = [...closure(k)].filter((f) => !base.has(f));
    // own chunk first, then its JS dependencies, CSS last
    files.sort((a, b) => (a === k ? -1 : b === k ? 1 : Number(a.endsWith(".css")) - Number(b.endsWith(".css"))));
    manifest[posix(o.entryPoint)] = files.map(rel);
  }
  return { manifest, entryFiles: [...base].map(rel), entryKey };
}

const gz = (file) => (existsSync(file) ? gzipSync(readFileSync(file)).length : 0);

/**
 * @param {{ manifest: Record<string,string[]>, entryFiles: string[] }} m
 * @param {string} outdir
 * @param {{ entry?: number, route?: number, fail?: boolean } | false | undefined} budget  gzip bytes (JS + CSS)
 */
export function sizeReport(m, outdir, budget) {
  const size = (files) => {
    let js = 0, css = 0;
    for (const f of files) { const n = gz(resolve(outdir, f)); if (f.endsWith(".css")) css += n; else js += n; }
    return { js, css };
  };
  const rows = [{ name: "(entry)", files: m.entryFiles, ...size(m.entryFiles), entry: true }];
  for (const [k, files] of Object.entries(m.manifest)) rows.push({ name: k, files, ...size(files), entry: false });
  const b = budget === false ? null : { entry: 15 * 1024, route: 60 * 1024, fail: false, ...(budget ?? {}) };
  const over = [];
  for (const r of rows) {
    const limit = b ? (r.entry ? b.entry : b.route) : Infinity;
    r.over = r.js > limit; // the budget is for JavaScript (CSS is reported)
    if (r.over) over.push(r);
  }
  return { rows, over, budget: b };
}

export function printReport(rep, log = console.log) {
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  log("  size (gzip)                           JS        CSS");
  for (const r of rep.rows) log(`  ${r.over ? "\x1b[33m!" : " "} ${r.name.padEnd(36).slice(0, 36)} ${kb(r.js).padStart(8)}  ${kb(r.css).padStart(8)}${r.over ? "  over budget\x1b[0m" : ""}`);
  if (rep.budget) log(`  budget: entry JS ≤ ${kb(rep.budget.entry)}, route JS ≤ ${kb(rep.budget.route)} (march.config.js › budget)`);
}

/** `_headers` for static hosts: hashed files are cached forever, the HTML and the service worker are revalidated. */
export function headersFile() {
  return [
    "/assets/*", "  Cache-Control: public, max-age=31536000, immutable", "",
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
  const want = new Set(files.map((f) => posix(relative(cwd, resolve(outdir, f)))));
  const by = new Map();
  for (const [k, o] of Object.entries(meta.outputs)) {
    if (!want.has(posix(k)) || !k.endsWith(".js")) continue;
    for (const [inp, v] of Object.entries(o.inputs)) by.set(inp, (by.get(inp) ?? 0) + v.bytesInOutput);
  }
  return [...by].sort((a, b) => b[1] - a[1]).slice(0, n).map(([file, bytes]) => ({ file, bytes }));
}
