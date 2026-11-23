#!/usr/bin/env node
// The numbers sites show about March (cdn-data.mjs publishes them as data/stats.json; marchjs.com's home page reads
// them), from their one source each, so none is typed by hand:
//   components per category  src/components/<category>/<name>/meta.ts (tools/gen-registry.js) + categories.ts
//   exports, components      every package export (tools/api-coverage.js packageApis)
//   icons                    built-in set (src/icons/catalog.ts) + open icon packs (src/icons/packs/*/pack.json)
//   animations               text animations (src/motion/text/meta.ts) + page transition effects (src/motion/page-fx.ts)
//   runtime dependencies     package.json dependencies
//   managers                 src/managers/<name>/index.ts
//   themes                   src/css/themes/<id>.css (the ready themes)
//   tests                    test( / it( calls in test/ and src/**/*.test.js
// The site's budgets and measured sizes are the site's own (its march.config.js and march-report.json).
//   node tools/gen-home-stats.js            print them
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageApis } from "./api-coverage.js";
import { categories, components } from "./gen-registry.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return n === "node_modules" ? [] : isDir(p) ? walk(p) : [p]; });

/** Every number the home page shows, from the sources above. */
export async function homeStats(root = ROOT) {
  const cats = await categories(root);
  const comps = (await components(root)).filter((c) => c && c.category);
  const perCategory = cats.map((c) => ({ id: c.id, title: c.title, components: comps.filter((x) => x.category === c.id).length }));

  const seen = new Map();
  for (const a of packageApis(root)) for (const i of a.items) seen.set(`${i.file}#${i.name}`, i.kind);
  const kinds = [...seen.values()];
  const subpaths = packageApis(root).length;

  const catalog = readFileSync(join(root, "src/icons/catalog.ts"), "utf8");
  const builtIn = [...catalog.matchAll(/^\s+[\w$]+: \{ name: "/gm)].length;
  const packsDir = join(root, "src/icons/packs");
  const packs = isDir(packsDir) ? readdirSync(packsDir).filter((n) => existsSync(join(packsDir, n, "pack.json")))
    .map((n) => JSON.parse(readFileSync(join(packsDir, n, "pack.json"), "utf8"))) : [];

  const textMeta = readFileSync(join(root, "src/motion/text/meta.ts"), "utf8");
  const text = [...textMeta.matchAll(/fam\("\w+",\s*\w+,\s*"([^"]+)"\)/g)].reduce((s, m) => s + m[1].trim().split(/\s+/).length, 0);
  const fx = /PAGE_VARIANTS[^=]*=\s*\[([^\]]*)\]/.exec(readFileSync(join(root, "src/motion/page-fx.ts"), "utf8"));
  const pageFx = fx ? fx[1].split(",").filter((s) => s.trim()).length : 0;

  const managers = readdirSync(join(root, "src/managers")).filter((n) => existsSync(join(root, "src/managers", n, "index.ts"))).length;

  const themes = readdirSync(join(root, "src/css/themes")).filter((n) => n.endsWith(".css")).length;

  const testFiles = [...walk(join(root, "test")), ...walk(join(root, "src"))].filter((p) => /\.test\.(js|ts|mjs)$/.test(p));
  const tests = testFiles.reduce((s, p) => s + [...readFileSync(p, "utf8").matchAll(/(?:^|[^\w.$])(?:test|it)\(\s*["'`]/g)].length, 0);

  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

  return {
    dependencies: Object.keys(pkg.dependencies ?? {}).length,
    components: kinds.filter((k) => k === "component").length,
    registered: comps.length,
    exports: kinds.filter((k) => k !== "icon").length,
    subpaths,
    categories: perCategory,
    icons: { total: builtIn + packs.reduce((s, p) => s + (p.count ?? 0), 0), builtIn, packs: packs.length },
    animations: { total: text + pageFx, text, pageFx },
    managers,
    themes,
    tests,
    testFiles: testFiles.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await homeStats(), null, 2));
