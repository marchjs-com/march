#!/usr/bin/env node
// The data published with each version on cdn.marchjs.com (<version>/data/), for sites and tools that render March
// without its sources (marchjs.com reads it for the version it pins). From March's sources and docs only:
//   data/api/index.en.json, index.tr.json, docs-<n>.json   the API reference (tools/api-docs.js, without the site's links)
//   data/ide/march-types.json, march-icons/<pack>.d.ts      MarchIDE's TypeScript: the package's declarations (gen-ide-types)
//   data/ide/lib-docs/…                                     MarchIDE's hover docs of the language's built-ins
//   data/components.json                                    the categories and the components (meta.ts, docs.md)
//   data/comp/<category>.json                               each component's props table, notes, accessibility (docs.md)
//   data/stats.json                                         the numbers: components, exports, icons, animations, tests…
//   data/index.json                                         the files above, with the version
// tools/build-cdn.js calls writeData(out); alone: node tools/cdn-data.mjs <folder> (default cdn/dist/<version>).
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, relative, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { generate as apiDocs } from "./api-docs.js";
import { categories, components, generate as registry } from "./gen-registry.js";
import { homeStats } from "./gen-home-stats.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Write data/ into a version folder (`out`, e.g. cdn/dist/0.3.1). */
export async function writeData(out) {
  const data = join(out, "data");
  const put = (rel, text) => { mkdirSync(dirname(join(data, rel)), { recursive: true }); writeFileSync(join(data, rel), text); };

  // the API reference: the same files as the showcase's, March's own fields only
  const { files } = apiDocs(ROOT);
  for (const [rel, text] of Object.entries(files)) put(`api/${basename(rel)}`, text);

  // MarchIDE's TypeScript: the declarations (march-types.json, march-icons/ beside it) and the built-ins' hover docs
  execFileSync(process.execPath, [join(ROOT, "tools", "gen-ide-types.mjs"), join(data, "ide", "march-types.json")], { stdio: "inherit" });
  rmSync(join(data, "ide", "march-types.json.stamp"), { force: true }); // the generator's own up-to-date marker
  cpSync(join(ROOT, "src", "components", "composite", "app-ui", "lib-docs"), join(data, "ide", "lib-docs"), { recursive: true });

  // the components: categories and each component's meta.ts (plain values) and docs.md
  const plain = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "function" ? undefined : x)));
  const list = await components(ROOT);
  put("components.json", JSON.stringify({ categories: plain(await categories(ROOT)),
    components: list.map((c) => ({ folder: c.folder, category: c.category, name: c.name, meta: plain(c.meta), docs: c.docs })) }));

  // each component's props table, notes and accessibility, per category (the files the site's component pages read)
  const { comp } = await registry(ROOT);
  for (const [rel, text] of Object.entries(comp)) put(rel, text);
  // the numbers sites show (components per category, exports, icons, animations, managers, themes, tests)
  const stats = await homeStats(ROOT);
  put("stats.json", `${JSON.stringify(stats, null, 2)}\n`);

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
