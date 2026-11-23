#!/usr/bin/env node
// Size budget of the CDN build (cdn.marchjs.com): what a page downloads when it imports one entry from the CDN. A browser
// does not tree-shake: importing an entry loads its file and every chunk it imports statically (its closure). Every
// page loads the core ("march") once, so an entry is measured on top of it: the gzip size of the closure files the
// core's closure does not have. Budgets (cdn/budget.json): a default for component entries (march/components/<category>/
// <name>) and one for the other entries; an entry past its default needs a limit of its own with a reason. Icon packs
// are data (a page loads the one it uses) and have no budget.
//   node tools/cdn-size.mjs [cdn/dist/<version>]              the sizes, the over-budget rows
//   node tools/cdn-size.mjs [dir] --baseline "why"            give every entry past its default a limit (measured +15%)
// build-cdn.js writes the measurement into the version as sizes.json (closure files too: a site can modulepreload them)
// and fails the build when an entry is over its budget.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const BUDGET_FILE = join(ROOT, "cdn", "budget.json");

const STATIC = /(?:^|[;}\s])(?:import|export)\s*(?:[\w$*{},\s]*from\s*)?["'](\.{1,2}\/[^"']+\.js)["']/g;

/**
 * Measure a CDN version folder (importmap.json beside the entries).
 * @param {string} dir
 * @returns {{ core: { js: number, files: string[] }, entries: Record<string, { js: number, added: number, css: number, files: string[] }> }}
 */
export function measure(dir) {
  const map = JSON.parse(readFileSync(join(dir, "importmap.json"), "utf8")).imports;
  const gz = new Map();
  const size = (f) => { if (!gz.has(f)) gz.set(f, gzipSync(readFileSync(f)).length); return gz.get(f); };
  const deps = (f) => [...readFileSync(f, "utf8").matchAll(STATIC)].map((m) => resolve(dirname(f), m[1]));
  const closure = (f) => { const seen = new Set([f]), st = [f]; while (st.length) for (const d of deps(st.pop())) if (!seen.has(d) && existsSync(d)) { seen.add(d); st.push(d); } return seen; };
  const fileOf = (url) => join(dir, ...new URL(url).pathname.split("/").slice(2));
  const rel = (f) => relative(dir, f).split("\\").join("/");
  const core = map.march ? closure(fileOf(map.march)) : new Set();
  const entries = {};
  for (const [spec, url] of Object.entries(map)) {
    const f = fileOf(url), c = closure(f), css = f.replace(/\.js$/, ".css");
    entries[spec] = {
      js: [...c].reduce((n, x) => n + size(x), 0),
      added: [...c].filter((x) => !core.has(x)).reduce((n, x) => n + size(x), 0),
      css: existsSync(css) && spec !== "march" ? size(css) : 0,
      files: [...c].map(rel).sort(),
    };
  }
  return { core: { js: [...core].reduce((n, x) => n + size(x), 0), files: [...core].map(rel).sort() }, entries };
}

/** The budget file: { component, entry, core, limits: { spec: { limit, why } } } (gzip bytes). */
export const readBudget = (file = BUDGET_FILE) => JSON.parse(readFileSync(file, "utf8"));

const isIcons = (spec) => spec.startsWith("march/icons/");
/** The limit of one entry (bytes, measured on top of the core), or null for an icon pack. */
export function limitOf(spec, budget) {
  if (isIcons(spec)) return null;
  if (spec === "march") return budget.limits?.march?.limit ?? budget.core;
  return budget.limits?.[spec]?.limit ?? (spec.startsWith("march/components/") ? budget.component : budget.entry);
}

/** The entries over their budget: [{ spec, size, limit }] (the core by its whole closure, the rest on top of it). */
export function check(sizes, budget) {
  const over = [];
  for (const [spec, e] of Object.entries(sizes.entries)) {
    const limit = limitOf(spec, budget);
    const n = spec === "march" ? e.js : e.added;
    if (limit != null && n > limit) over.push({ spec, size: n, limit });
  }
  return over;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const dir = resolve(argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--baseline") ?? join(ROOT, "cdn", "dist", pkg.version));
  if (!existsSync(join(dir, "importmap.json"))) { console.error(`✖ ${dir}: no importmap.json (node tools/build-cdn.js first)`); process.exit(2); }
  const sizes = measure(dir);
  const budget = readBudget();
  if (argv.includes("--baseline")) {
    const why = argv[argv.indexOf("--baseline") + 1];
    if (!why || why.startsWith("--")) { console.error('✖ --baseline needs a reason: --baseline "why"'); process.exit(2); }
    const limits = { ...budget.limits };
    for (const { spec, size } of check(sizes, { ...budget, limits: {} })) if (!limits[spec] || limits[spec].limit < size) limits[spec] = { limit: Math.ceil((size * 1.15) / 5120) * 5120, why };
    writeFileSync(BUDGET_FILE, `${JSON.stringify({ ...budget, limits: Object.fromEntries(Object.entries(limits).sort(([a], [b]) => (a < b ? -1 : 1))) }, null, 1)}\n`);
    console.log(`cdn/budget.json: ${Object.keys(limits).length} entries with a limit of their own`);
  }
  const rows = Object.entries(sizes.entries).filter(([s]) => !isIcons(s)).sort((a, b) => b[1].added - a[1].added);
  console.log(`core (march): ${kb(sizes.core.js)} in ${sizes.core.files.length} files; ${rows.length} entries (icon packs aside), on top of it:`);
  for (const [s, e] of rows.slice(0, 15)) console.log(`  ${s.padEnd(44)} ${kb(e.added).padStart(9)}  limit ${kb(limitOf(s, readBudget()))}`);
  const over = check(sizes, readBudget());
  for (const o of over) console.error(`✖ ${o.spec}: ${kb(o.size)} > ${kb(o.limit)}`);
  process.exit(over.length ? 1 : 0);
}
