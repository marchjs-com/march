#!/usr/bin/env node
// Runs the source generators (registry, API reference, icons, themes, CSS tables…) only when their inputs changed.
// Each generator has a content digest of its inputs (file paths + bytes) and of its own script; the digest after its
// last run is kept in node_modules/.cache/march/gen.json. Same digest and every output present → skipped.
//   node tools/gen-all.mjs            run the stale generators (the showcase build calls this, --dev and --release)
//   node tools/gen-all.mjs --force    run all of them
//   node tools/gen-all.mjs --list     print each generator and whether it is stale, run nothing
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "node_modules", ".cache", "march", "gen.json");

/**
 * Only generators whose output a test holds equal to a fresh run (`--check` or generate() compared in test/): their
 * files are pure functions of the inputs. Not here: tools/gen-css.js (src/css/sx.css has hand-written rules since) and
 * bench/text-size.js --write (measured sizes, refreshed on purpose).
 * inputs: files or folders (relative to the root; a folder means every file under it, generated outputs included —
 * the digest is taken again after the run, so a generator that writes inside its own inputs is not stale next time).
 * outputs: files that must exist (a missing one forces a run).
 */
export const GENERATORS = [
  { name: "icons", script: "tools/gen-icon-catalog.js", inputs: ["src/icons/set.ts"], outputs: ["src/icons/catalog.ts", "src/icons/all.ts"] },
  { name: "themes", script: "tools/gen-themes.js", inputs: ["src/theme/presets.ts", "src/theme/contrast.ts", "src/core/util.ts"], outputs: ["src/css/themes.css", "src/theme/names.ts"] },
  { name: "accent", script: "tools/gen-accent.js", inputs: ["src/css/colors.css"], outputs: ["src/ui/accent.css"] },
  { name: "grid", script: "tools/gen-grid.js", inputs: [], outputs: ["src/components/layout/grid/grid.css"] },
  { name: "registry", script: "tools/gen-registry.js", inputs: ["src/components", "examples/showcase/src/sections.gen.ts"], outputs: ["src/components/registry.gen.ts", "docs/components.md"] },
  // reads every package export's JSDoc: the whole src/ tree and package.json (which the registry writes)
  { name: "api", script: "tools/api-coverage.js", inputs: ["src", "package.json", "docs/api.tr.json"], outputs: [] },
  // the API page data (public/api/*.json): JSDoc, Turkish summaries, long-form docs and the examples' demo links
  { name: "api-docs", script: "tools/api-docs.js", inputs: ["src", "package.json", "docs/api.tr.json", "docs/api", "examples/showcase/src/api-examples"], outputs: ["examples/showcase/public/api/index.en.json"] },
];

const SKIP_DIR = new Set(["node_modules", ".git", "dist"]);
function files(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return [rel];
  return readdirSync(abs, { withFileTypes: true }).filter((d) => !SKIP_DIR.has(d.name)).sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap((d) => files(`${rel}/${d.name}`));
}

// one read per file and run: the registry and the API reference both cover src/components
const hashes = new Map();
const fileHash = (f) => { if (!hashes.has(f)) hashes.set(f, createHash("sha1").update(readFileSync(join(ROOT, f))).digest("hex")); return hashes.get(f); };

/** Content digest of a generator: its script and every input file (path + bytes). */
export function digest(g) {
  const h = createHash("sha1");
  const seen = new Set();
  for (const f of [g.script, ...g.inputs.flatMap(files)]) {
    if (seen.has(f) || !existsSync(join(ROOT, f))) continue;
    seen.add(f);
    h.update(f).update("\0").update(fileHash(f)).update("\0");
  }
  return h.digest("hex");
}

const readCache = () => { try { return JSON.parse(readFileSync(CACHE, "utf8")); } catch { return {}; } };

/** Runs the stale generators; returns { ran: [names], skipped: [names], ms }. Throws when a generator fails. */
export function genAll({ force = false, list = false, log = console.log } = {}) {
  const t0 = performance.now();
  const cache = readCache();
  const ran = [], skipped = [];
  for (const g of GENERATORS) {
    const stale = force || cache[g.name] !== digest(g) || g.outputs.some((o) => !existsSync(join(ROOT, o)));
    if (list) { log(`  ${stale ? "stale" : "fresh"}  ${g.name}`); continue; }
    if (!stale) { skipped.push(g.name); continue; }
    const t = performance.now();
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(join(ROOT, "compiler/register.js")).href, join(ROOT, g.script), ...(g.args ?? [])], { cwd: ROOT, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`gen ${g.name} (${g.script}) failed:\n${r.stdout}${r.stderr}`);
    hashes.clear(); // it may have written inside its own (or a later generator's) inputs
    cache[g.name] = digest(g);
    ran.push(g.name);
    log(`  gen ${g.name}: ${Math.round(performance.now() - t)} ms`);
  }
  if (!list) { mkdirSync(dirname(CACHE), { recursive: true }); writeFileSync(CACHE, `${JSON.stringify(cache, null, 2)}\n`); }
  return { ran, skipped, ms: Math.round(performance.now() - t0) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = genAll({ force: process.argv.includes("--force"), list: process.argv.includes("--list") });
    if (!process.argv.includes("--list")) console.log(`✔ gen: ${r.ran.length} ran${r.ran.length ? ` (${r.ran.join(", ")})` : ""}, ${r.skipped.length} up to date, ${r.ms} ms`);
  } catch (e) { console.error(`✖ ${e.message}`); process.exit(1); }
}
