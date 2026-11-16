#!/usr/bin/env node
// The CDN build (cdn.marchjs.com): every browser entry of the package as a minified ES module, sharing its chunks, in
// cdn/dist/<version>/ — march.js (the "." entry), ui.js, app-ui.js, behaviors/drag.js, icons/lucide.js… — with
//   march.css        every stylesheet of every entry, in one file (a page links this one)
//   <entry>.css      the stylesheets of one entry (when it has any)
//   css/…            the stylesheets the package exports as files (tokens.css, themes/…)
//   importmap.json   { imports: { "march": ".../march.js", "march/ui": ".../ui.js", … } } with absolute URLs
//   files.json       every file of the version (a deploy uses it to keep the older versions)
// and the same files again in cdn/dist/latest/. Usage: node tools/build-cdn.js [--base https://cdn.marchjs.com]
import { readFileSync, writeFileSync, rmSync, cpSync, readdirSync, statSync, existsSync, renameSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const argv = process.argv.slice(2);
const BASE = (argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "https://cdn.marchjs.com").replace(/\/$/, "");
const version = pkg.version;
const dist = join(root, "cdn", "dist"), out = join(dist, version);

// node-only or build-time entries stay out
const SKIP = new Set(["./testing", "./compiler", "./esbuild", "./register", "./components/registry.gen.ts", "./components/meta.ts"]);
/** The entries: export subpath → { in: source, out: name in the version folder } */
const entries = [];
for (const [key, target] of Object.entries(pkg.exports)) {
  const file = typeof target === "string" ? target : target.import ?? target.default;
  if (SKIP.has(key) || typeof file !== "string" || !/\.(ts|js)$/.test(file) || !file.startsWith("./src/")) continue;
  if (key.includes("*")) {
    // icons/<pack> and icons/<pack>/pack: one entry per pack there is
    if (!key.startsWith("./icons/")) continue;
    const dir = join(root, "src/icons/packs");
    for (const id of existsSync(dir) ? readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()) : []) {
      const src = join(root, file.replace("*", id));
      if (existsSync(src)) entries.push({ spec: `march/${key.slice(2).replace("*", id)}`, in: src, out: key.slice(2).replace("*", id) });
    }
    continue;
  }
  entries.push({ spec: key === "." ? "march" : `march/${key.slice(2)}`, in: join(root, file), out: key === "." ? "march" : key.slice(2) });
}

rmSync(out, { recursive: true, force: true });
const loader = { ".woff2": "file", ".woff": "file", ".png": "file", ".svg": "file", ".jpg": "file", ".webp": "file" };
const banner = { js: `/*! MarchJS v${version} | MIT | marchjs.com */`, css: `/*! MarchJS v${version} | MIT | marchjs.com */` };
const t0 = performance.now();
await esbuild.build({
  entryPoints: entries.map((e) => ({ in: e.in, out: e.out })), outdir: out, bundle: true, splitting: true, format: "esm",
  target: "es2022", minify: true, legalComments: "none", banner, loader, chunkNames: "_/[name]-[hash]", assetNames: "_/[name]-[hash]",
  define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning",
});
// march.css: every entry's stylesheets in one file (a JS entry that imports them all; only its CSS is kept)
const all = join(dist, ".all.js");
// the design tokens first and the sx utilities (an app imports march/css/tokens.css and sx.css itself; a CDN page
// links march.css alone)
const own = ["tokens.css", "sx.css"].map((f) => `import ${JSON.stringify(join(root, "src/css", f).replace(/\\/g, "/"))};\n`).join("");
writeFileSync(all, own + entries.filter((e) => !e.out.startsWith("icons/")).map((e, i) => `export * as e${i} from ${JSON.stringify(e.in.replace(/\\/g, "/"))};`).join("\n"));
await esbuild.build({ entryPoints: { march: all }, outdir: join(dist, ".css"), bundle: true, minify: true, legalComments: "none", banner, loader, assetNames: "_/[name]-[hash]", logLevel: "warning", write: true });
renameSync(join(dist, ".css", "march.css"), join(out, "march.css"));
if (existsSync(join(dist, ".css", "_"))) cpSync(join(dist, ".css", "_"), join(out, "_"), { recursive: true });
rmSync(join(dist, ".css"), { recursive: true, force: true });
rmSync(all, { force: true });
// the stylesheets the package exports as files
cpSync(join(root, "src/css"), join(out, "css"), { recursive: true });

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const url = (name) => `${BASE}/${version}/${name}`;
const importmap = { imports: Object.fromEntries(entries.map((e) => [e.spec, url(`${e.out}.js`)])) };
writeFileSync(join(out, "importmap.json"), `${JSON.stringify(importmap, null, 2)}\n`);
const files = walk(out).map((f) => relative(out, f).replace(/\\/g, "/")).sort();
writeFileSync(join(out, "files.json"), `${JSON.stringify({ version, files: [...files, "files.json"] }, null, 2)}\n`);
// latest: the same files (its importmap points at latest/)
const latest = join(dist, "latest");
rmSync(latest, { recursive: true, force: true });
cpSync(out, latest, { recursive: true });
writeFileSync(join(latest, "importmap.json"), `${JSON.stringify({ imports: Object.fromEntries(entries.map((e) => [e.spec, `${BASE}/latest/${e.out}.js`])) }, null, 2)}\n`);

const size = walk(out).reduce((n, f) => n + statSync(f).size, 0);
console.log(`cdn/dist/${version}: ${entries.length} entries, ${files.length} files, ${(size / 1024 / 1024).toFixed(1)} MB (${Math.round(performance.now() - t0)} ms); also latest/`);
