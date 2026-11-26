#!/usr/bin/env node
// The data published with each version on cdn.marchjs.com (<version>/data/), for sites and tools that render March
// without its sources (marchjs.com reads it for the version it pins). From March's sources and docs only:
//   data/api/index.en.json, index.tr.json, docs-<n>.json   the API reference (tools/api-docs.js, without the site's links)
//   data/ide/march-types.json, march-icons/<pack>.d.ts      MarchIDE's TypeScript: the package's declarations (gen-ide-types)
//   data/ide/lib-docs/…                                     MarchIDE's hover docs of the language's built-ins
//   data/components.json                                    the categories and the components (meta.ts, docs.md, the
//                                                           class of the root element, `added`: the day it first
//                                                           appeared, YYYY-MM-DD, from git: a site's "New" badges)
//   data/comp/<category>.json                               each component's props table, notes, accessibility (docs.md)
//   data/stats.json                                         the numbers: components, exports, icons, animations, tests…
//   data/text-costs.json                                    what each text animation costs (gzip bytes over the motion
//                                                           engine: bench/text-size.js), a site's cost badges
//   data/index.json                                         the files above, with the version
// tools/build-cdn.js calls writeData(out); alone: node tools/cdn-data.mjs <folder> (default cdn/dist/<version>).
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, relative, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { generate as apiDocs } from "./api-docs.js";
import { categories, components, rootClass, generate as registry } from "./gen-registry.js";
import { homeStats } from "./gen-home-stats.js";
import { textCosts } from "../bench/text-size.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The day each component folder (`category/name`) first appeared, YYYY-MM-DD: the earliest commit touching a file in
 * it, following renames (a component moved to another category keeps its day). One `git log` over src/components.
 * A folder git does not know yet gets today. Needs the full history: a shallow clone is deepened first, and when
 * that fails (no git, no remote) the map is empty and no component gets `added` (no false "New" everywhere).
 */
export function addedDates(root = ROOT) {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
  const days = new Map();
  try {
    if (git("rev-parse", "--is-shallow-repository").trim() === "true") git("fetch", "--quiet", "--unshallow");
    const folder = (p) => /^src\/components\/([^/]+\/[^/]+)\//.exec(p ?? "")?.[1];
    let day;
    for (const line of git("log", "--reverse", "--format=@%cs", "--name-status", "-M", "--", "src/components").split("\n")) {
      if (line.startsWith("@")) { day = line.slice(1); continue; }
      const [status, a, b] = line.split("\t");
      const to = folder(status?.[0] === "R" || status?.[0] === "C" ? b : a);
      if (to && !days.has(to)) days.set(to, (status[0] === "R" && days.get(folder(a))) || day);
    }
  } catch { return new Map(); }
  return days;
}

/** Write data/ into a version folder (`out`, e.g. cdn/dist/0.3.1). */
export async function writeData(out) {
  const data = join(out, "data");
  const put = (rel, text) => { mkdirSync(dirname(join(data, rel)), { recursive: true }); writeFileSync(join(data, rel), text); };

  // the API reference (a site adds its own links to it)
  const { files } = apiDocs(ROOT);
  for (const [rel, text] of Object.entries(files)) put(`api/${basename(rel)}`, text);

  // MarchIDE's TypeScript: the declarations (march-types.json, march-icons/ beside it) and the built-ins' hover docs
  execFileSync(process.execPath, [join(ROOT, "tools", "gen-ide-types.mjs"), join(data, "ide", "march-types.json")], { stdio: "inherit" });
  rmSync(join(data, "ide", "march-types.json.stamp"), { force: true }); // the generator's own up-to-date marker
  cpSync(join(ROOT, "src", "components", "composite", "app-ui", "lib-docs"), join(data, "ide", "lib-docs"), { recursive: true });

  // the components: categories and each component's meta.ts (plain values), docs.md and root element class
  const plain = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "function" ? undefined : x)));
  const list = await components(ROOT);
  const added = addedDates(ROOT);
  const today = new Date().toISOString().slice(0, 10);
  put("components.json", JSON.stringify({ categories: plain(await categories(ROOT)),
    components: list.map((c) => ({ folder: c.folder, category: c.category, name: c.name, meta: plain(c.meta), docs: c.docs, root: rootClass(c, ROOT),
      ...(added.size ? { added: added.get(c.folder) ?? today } : {}) })) }));

  // each component's props table, notes and accessibility, per category (the files the site's component pages read)
  const { comp } = await registry(ROOT);
  for (const [rel, text] of Object.entries(comp)) put(rel, text);
  // the numbers sites show (components per category, exports, icons, animations, managers, themes, tests)
  const stats = await homeStats(ROOT);
  put("stats.json", `${JSON.stringify(stats, null, 2)}\n`);
  // what one import of each text animation (march/motion/text) adds over the motion engine, measured as an app build
  put("text-costs.json", `${JSON.stringify(await textCosts(), null, 2)}\n`);

  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const all = walk(data).map((f) => relative(data, f).replace(/\\/g, "/")).filter((f) => f !== "index.json").sort();
  put("index.json", `${JSON.stringify({ version: pkg.version, files: all }, null, 2)}\n`);
  return all.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const out = resolve(process.argv[2] ?? join(ROOT, "cdn", "dist", pkg.version));
  const n = await writeData(out);
  console.log(`✔ ${relative(ROOT, join(out, "data")).replace(/\\/g, "/")}: ${n} files`);
}
