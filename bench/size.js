#!/usr/bin/env node
// Gzip size of each March entry point (minified ESM bundle, tree-shaken from that entry only).
// Budget for the core lives in BUDGET; test/size.test.js fails when it is exceeded.
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

export const BUDGET = { core: 10.5 * 1024, minimal: 5 * 1024 };
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const ENTRIES = { core: "src/index.ts", router: "src/router/index.ts", data: "src/data/index.ts", schema: "src/schema/index.ts", ui: "src/ui/index.ts", table: "src/table/index.ts", charts: "src/charts/index.ts" };

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
  const r = await esbuild.build({ stdin: { contents: 'export { signal, computed, effect, h, render } from "./src/index.ts";', resolveDir: ROOT }, bundle: true, minify: true, format: "esm", write: false, logLevel: "silent" });
  const code = r.outputFiles[0].contents;
  out.minimal = { min: code.length, gzip: gzipSync(code, { level: 9 }).length };
  return out;
}

/**
 * Build a small app the way `march build` does (March esbuild plugin: component CSS follows the code that uses it) and
 * return its JS and CSS. `source` is the app's main.tsx.
 */
export async function buildApp(source) {
  const esbuild = await import("esbuild");
  const { march } = await import("../compiler/esbuild.js");
  const dir = mkdtempSync(join(tmpdir(), "hm-size-"));
  try {
    writeFileSync(join(dir, "main.tsx"), source);
    const r = await esbuild.build({ entryPoints: [join(dir, "main.tsx")], absWorkingDir: dir, bundle: true, minify: true, format: "esm", write: false,
      outdir: join(dir, "out"), logLevel: "silent", plugins: [march({ components: join(dir, "components") })] });
    const pick = (ext) => r.outputFiles.filter((f) => f.path.endsWith(ext)).map((f) => f.text).join(String.fromCharCode(10));
    const js = pick(".js"), css = pick(".css");
    const gz = (t) => gzipSync(Buffer.from(t), { level: 9 }).length;
    return { js, css, jsGzip: gz(js), cssGzip: gz(css) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
export const BUTTON_APP = `import "hadi-march/css/tokens.css";
import { render, h } from "hadi-march";
import { Button } from "hadi-march/ui";
render(() => h(Button, { variant: "primary" }, "Merhaba"), document.body);
`;
// buttonCss 5.25 KB: includes the color tokens every themable component reads (src/css/colors.css), the text / on-fill
// tones and the HADİ theme's multicolor defaults (progress, spinner)
export const APP_BUDGET = { buttonJs: 6.5 * 1024, buttonCss: 5.25 * 1024 };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await sizes();
  console.log("entry      min KB   gzip KB");
  for (const [n, v] of Object.entries(s)) console.log(`${n.padEnd(10)} ${(v.min / 1024).toFixed(1).padStart(6)}   ${(v.gzip / 1024).toFixed(2).padStart(7)}${BUDGET[n] ? `   (budget ${(BUDGET[n] / 1024).toFixed(0)} KB)` : ""}`);
}
