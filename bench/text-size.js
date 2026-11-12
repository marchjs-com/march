#!/usr/bin/env node
// Cost of hadi-march/motion/text, per animation (minified + gzip, tree-shaken like an app build).
//   engine   what any engine animation already pays (timeline + clock + drivers)
//   core     the shared text core on top of the engine (split + runner), measured with the smallest animation
//   each     what one more animation adds once the core is there
// test/motion-text.test.js fails when a single import or one animation grows past TEXT_BUDGET.
// Usage: node bench/text-size.js            (table)   node bench/text-size.js --json   (for the showcase badges)
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
/** gzip bytes: one animation import over the engine ≤ core; each further animation ≤ each. */
export const TEXT_BUDGET = { core: 2.25 * 1024, each: 900 };

async function gz(contents) {
  const esbuild = await import("esbuild");
  const r = await esbuild.build({ stdin: { contents, resolveDir: ROOT, loader: "ts" }, bundle: true, minify: true, format: "esm", write: false, logLevel: "silent", treeShaking: true });
  return gzipSync(r.outputFiles[0].contents, { level: 9 }).length;
}
const use = (names) => `import { ${names.join(", ")} } from "./src/motion/text/index.ts";\n${names.map((n) => `${n}(document.body);`).join("\n")}`;

/** { engine, core, single: { name: gzip of that one import }, each: { name: added over the core } } */
export async function textSizes(names) {
  const engine = await gz(`import { timeline } from "./src/motion/engine/playback.ts"; timeline().play();`);
  const single = {};
  for (const n of names) single[n] = (await gz(use([n]))) - engine;
  const base = Math.min(...Object.values(single));
  const each = Object.fromEntries(names.map((n) => [n, single[n] - base]));
  return { engine, core: base, single, each };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { TEXT_ANIMATIONS } = await import("../src/motion/text/meta.ts");
  const s = await textSizes(TEXT_ANIMATIONS.map((a) => a.name));
  if (process.argv.includes("--json")) console.log(JSON.stringify(Object.fromEntries(Object.entries(s.single).map(([k, v]) => [k, v]))));
  else {
    console.log(`engine ${s.engine} B gzip · text core ${s.core} B · budget core ${TEXT_BUDGET.core} B, each ${TEXT_BUDGET.each} B`);
    for (const [n, v] of Object.entries(s.single).sort((a, b) => b[1] - a[1])) console.log(`${n.padEnd(14)} ${String(v).padStart(5)} B   (+${s.each[n]} over the core)`);
  }
}
