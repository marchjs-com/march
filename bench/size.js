#!/usr/bin/env node
// Gzip size of each March entry point (minified ESM bundle, tree-shaken from that entry only).
// Budget for the core lives in BUDGET; test/size.test.js fails when it is exceeded.
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

// core = the whole barrel (every core export at once; apps tree-shake and pay only for what they import, see minimal).
// 11.25 KB since the layer stack + named portal targets (dom/portal.ts) became core: one mechanism for every overlay.
// 12.25 KB since template cloning (_tpl/_prop), selector() and the keyed list's fewest-moves reorder (LIS) became core:
// the speed work that makes March as fast as hand-written DOM code. App entries stay under their own 15 KB budget.
// 15.75 KB since extensions and interceptors (dom/extend.ts: extend, intercept, defineExtension, <Extensions>, the
// pipeline, partial targets inside / partOf and its tools) became core (+3.4 KB; docs/internal/size-watch.md). Apps that do not import them pay 0.
export const BUDGET = { core: 15.75 * 1024, minimal: 5 * 1024 };
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
  const dir = mkdtempSync(join(tmpdir(), "m-size-"));
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
/**
 * A typical small app (what most users ship first): signals, a keyed list, a condition and one component, written the
 * way the docs show it (JSX through the March plugin). Its JS gzip is the size that matters to an app, not the barrel.
 */
export const TYPICAL_APP = `import { render, signal, For, If } from "hadi-march";
import { Button } from "hadi-march/ui";
const todos = signal([{ id: 1, text: "Write docs", done: false }]);
const text = signal("");
const add = () => { const t = text().trim(); if (t) { todos.set([...todos(), { id: Date.now(), text: t, done: false }]); text.set(""); } };
function App() {
  return <main>
    <input value={text()} onInput={(e) => text.set(e.currentTarget.value)} />
    <Button variant="primary" on:click={add}>Add</Button>
    <If when={todos().length} fallback={<p>Nothing to do</p>}>
      <ul><For each={todos()} key="id">{(t) => <li class={t().done ? "done" : ""}>{t().text}</li>}</For></ul>
    </If>
  </main>;
}
render(() => <App />, document.body);
`;
// buttonCss 5.5 KB: includes the color tokens every themable component reads (src/css/colors.css), the text / on-fill
// tones, the HADİ theme's multicolor defaults (progress, spinner), themed subtrees (light / dark, font) and Button's
// weight, lg icon, label trim and turning own spinner: measured 5.36 KB
// typicalJs 7.75 KB: TYPICAL_APP measured 7.64 KB (h.ts is most of it: every prop kind setProp knows ships with it; Button
// carries its own spinner part, the link variant, pressed, pill and external links: about 0.2 KB)
export const APP_BUDGET = { buttonJs: 6.5 * 1024, buttonCss: 5.5 * 1024, typicalJs: 7.75 * 1024 };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await sizes();
  const app = await buildApp(TYPICAL_APP);
  s.typical = { min: app.js.length, gzip: app.jsGzip };
  console.log("entry      min KB   gzip KB");
  for (const [n, v] of Object.entries(s)) console.log(`${n.padEnd(10)} ${(v.min / 1024).toFixed(1).padStart(6)}   ${(v.gzip / 1024).toFixed(2).padStart(7)}${BUDGET[n] ? `   (budget ${(BUDGET[n] / 1024).toFixed(2)} KB)` : ""}`);
}
