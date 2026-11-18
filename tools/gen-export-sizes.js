#!/usr/bin/env node
// What each March component costs on its own: an app that imports only it (and draws nothing else), minified and
// gzipped (level 9), the core it needs included. MarchIDE's Bundle tab lists the code's March imports with these.
//   examples/showcase/public/export-sizes.json   { at, hash, base: { min, gzip }, items: { "march/ui#Button": [min, gzip] } }
// `base` is an app with only h() and render(): the core every app pays once. Measured again only when the source
// changed (`hash` of src/), so it is measured once (~25 s, `npm run sizes`) after a change of March itself.
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT = join(ROOT, "examples/showcase/public/export-sizes.json");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

/** A hash of every source file under src/ (what the sizes depend on). */
function sourceHash() {
  const h = createHash("sha1");
  const walk = (d) => { for (const n of readdirSync(d).sort()) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|js|css)$/.test(n)) h.update(n).update(readFileSync(p)); } };
  walk(join(ROOT, "src"));
  return h.digest("hex").slice(0, 16);
}

const hash = sourceHash();
const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
if (old?.hash === hash && !process.argv.includes("--force")) { console.log(`✔ export-sizes.json up to date (${Object.keys(old.items).length} components)`); process.exit(0); }

const esbuild = await import("esbuild");
const idx = JSON.parse(readFileSync(join(ROOT, "examples/showcase/public/api/index.en.json"), "utf8"));
const fileOf = (sub) => { const e = pkg.exports?.[`.${sub.slice("march".length)}`] ?? (sub === "march" ? pkg.exports?.["."] : undefined); const f = typeof e === "string" ? e : e?.import ?? e?.default; return f ? join(ROOT, f) : null; };
const measure = async (code) => {
  const r = await esbuild.build({ stdin: { contents: code, resolveDir: ROOT, loader: "ts" }, bundle: true, minify: true, format: "esm", write: false, logLevel: "silent", treeShaking: true,
    loader: { ".css": "empty", ".svg": "text", ".md": "text" }, define: { "process.env.NODE_ENV": '"production"' } });
  const text = r.outputFiles[0].text;
  return [Buffer.byteLength(text), gzipSync(text, { level: 9 }).length];
};
const core = fileOf("march");
const base = await measure(`import { h, render } from ${JSON.stringify(core)};\nglobalThis.__m = [h, render];`);
const items = {};
let n = 0;
for (const sp of idx.subpaths) {
  const file = fileOf(sp.subpath);
  if (!file || !existsSync(file)) continue;
  for (const [name, kind] of sp.items) {
    if (kind !== "component") continue;
    try { items[`${sp.subpath}#${name}`] = await measure(`import { h, render } from ${JSON.stringify(core)};\nimport { ${name} } from ${JSON.stringify(file)};\nglobalThis.__m = [h, render, ${name}];`); n++; }
    catch { /* a component that does not bundle alone */ }
  }
}
writeFileSync(OUT, JSON.stringify({ hash, base: { min: base[0], gzip: base[1] }, items }));
console.log(`✔ export-sizes.json: ${n} components measured (base ${(base[1] / 1024).toFixed(1)} KB gzip)`);
