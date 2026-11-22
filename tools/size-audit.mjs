#!/usr/bin/env node
// Per-module size of an entry (esbuild metafile): minified bytes each module adds to the entry's own output file
// (dynamic imports stay separate chunks) and the module's gzip size alone (minified, level 9), largest first.
//   node tools/size-audit.mjs                      core barrel (src/index.ts)
//   node tools/size-audit.mjs src/router/index.ts 20
// An app's entry and routes: node cli/march.js build --dev --analyze [/route] (in the app's folder).
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** @returns {Promise<{ min: number, gzip: number, modules: { file: string, min: number, gzip: number }[] }>} */
export async function audit(entry = "src/index.ts") {
  const esbuild = await import("esbuild");
  const r = await esbuild.build({ entryPoints: [resolve(ROOT, entry)], absWorkingDir: ROOT, bundle: true, minify: true, format: "esm", splitting: true,
    outdir: "out", write: false, metafile: true, logLevel: "silent", loader: { ".css": "empty", ".svg": "text", ".md": "text" } });
  const [key, out] = Object.entries(r.metafile.outputs).find(([, o]) => o.entryPoint === entry.replace(/\\/g, "/"));
  const file = r.outputFiles.find((f) => f.path.replace(/\\/g, "/").endsWith(key));
  const modules = [];
  for (const [f, v] of Object.entries(out.inputs)) {
    const loader = f.endsWith(".tsx") ? "tsx" : f.endsWith(".ts") ? "ts" : "js";
    const alone = await esbuild.transform(readFileSync(resolve(ROOT, f), "utf8"), { loader, minify: true }).catch(() => null);
    modules.push({ file: f, min: v.bytesInOutput, gzip: alone ? gzipSync(alone.code, { level: 9 }).length : 0 });
  }
  modules.sort((a, b) => b.min - a.min);
  return { min: out.bytes, gzip: file ? gzipSync(file.contents, { level: 9 }).length : 0, modules };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [entry = "src/index.ts", n = "30"] = process.argv.slice(2);
  const a = await audit(entry);
  const kb = (b) => (b / 1024).toFixed(2).padStart(6);
  console.log(`${entry}: ${kb(a.min)} KB min, ${kb(a.gzip)} KB gzip, ${a.modules.length} modules`);
  console.log("   min KB  gzip alone  module");
  for (const m of a.modules.slice(0, Number(n))) console.log(`  ${kb(m.min)}      ${kb(m.gzip)}  ${m.file}`);
}
