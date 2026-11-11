#!/usr/bin/env node
// Gzip size of each March entry point (minified ESM bundle, tree-shaken from that entry only).
// Budget for the core lives in BUDGET; test/size.test.js fails when it is exceeded.
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const BUDGET = { core: 9 * 1024, minimal: 5 * 1024 };
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const ENTRIES = { core: "src/index.js", router: "src/router/index.js", data: "src/data/index.js", schema: "src/schema/index.js", ui: "src/ui/index.js", table: "src/table/index.js", charts: "src/charts/index.js" };

export async function sizes(names = Object.keys(ENTRIES)) {
  const esbuild = await import("esbuild");
  const out = {};
  for (const n of names) {
    try {
      const r = await esbuild.build({ entryPoints: [resolve(ROOT, ENTRIES[n])], bundle: true, minify: true, format: "esm", write: false, logLevel: "silent", treeShaking: true });
      const code = r.outputFiles[0].contents;
      out[n] = { min: code.length, gzip: gzipSync(code, { level: 9 }).length };
    } catch { /* module missing */ }
  }
  // minimal app: what a counter needs (signals + h + render), after tree shaking
  const r = await esbuild.build({ stdin: { contents: 'export { signal, computed, effect, h, render } from "./src/index.js";', resolveDir: ROOT }, bundle: true, minify: true, format: "esm", write: false, logLevel: "silent" });
  const code = r.outputFiles[0].contents;
  out.minimal = { min: code.length, gzip: gzipSync(code, { level: 9 }).length };
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await sizes();
  console.log("entry      min KB   gzip KB");
  for (const [n, v] of Object.entries(s)) console.log(`${n.padEnd(10)} ${(v.min / 1024).toFixed(1).padStart(6)}   ${(v.gzip / 1024).toFixed(2).padStart(7)}${BUDGET[n] ? `   (budget ${(BUDGET[n] / 1024).toFixed(0)} KB)` : ""}`);
}
