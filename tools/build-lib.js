#!/usr/bin/env node
// Builds the publishable library into dist/: every src/**/*.ts transpiled to plain ES module JS (imports rewritten to .js,
// no bundling, no minification) plus .d.ts declarations from tsc, CSS copied. The runtime stays dependency free.
import { readdirSync, statSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import * as esbuild from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src"), out = join(root, "dist");
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
rmSync(out, { recursive: true, force: true });
const files = walk(src);
const ts = files.filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
await esbuild.build({
  entryPoints: ts, outdir: out, outbase: src, format: "esm", target: "es2022", bundle: false, logLevel: "warning",
  plugins: [{ name: "rewrite-ts-imports", setup(b) { b.onLoad({ filter: /\.ts$/ }, async (a) => {
    const { readFile } = await import("node:fs/promises");
    const code = (await readFile(a.path, "utf8")).replace(/(from\s+["'][^"']+)\.ts(["'])/g, "$1.js$2").replace(/(import\(\s*["'][^"']+)\.ts(["']\s*\))/g, "$1.js$2");
    return { contents: code, loader: "ts" };
  }); } }],
});
for (const f of files.filter((x) => x.endsWith(".css"))) { const t = join(out, relative(src, f)); mkdirSync(dirname(t), { recursive: true }); cpSync(f, t); }
execFileSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", join(root, "tsconfig.build.json")], { stdio: "inherit" });
console.log(`dist/: ${ts.length} modules + declarations`);
// declarations: point relative imports at the emitted .js files
const { readFileSync, writeFileSync } = await import("node:fs");
for (const f of walk(out).filter((x) => x.endsWith(".d.ts"))) {
  const t = readFileSync(f, "utf8");
  const n = t.replace(/((?:from|import)\s*\(?\s*["']\.{1,2}\/[^"']+)\.ts(["'])/g, "$1.js$2");
  if (n !== t) writeFileSync(f, n);
}
