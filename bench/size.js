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
// 15.8 KB since sx works on components (the sx common prop and _sxClass shared with elements) and its scales are
// exported (SX); m:text-color lives in march/props (docs/internal/size-watch.md).
// 15.9 KB since sx has a colour key (the 24 colour words of sx color: the text colour, which replaced m:text-color).
// 16.45 KB since generator components (dom/generator.ts: _gen, generator(); +0.51 KB). Tree-shaken: only an app that writes a
// function* / async function* component pays (minimal unchanged; docs/internal/size-watch.md).
// 16.5 KB since a component's own error goes up through a render extension (dom/extend.ts: it is no longer reported as the
// extension's and swallowed; measured 16.46 KB)
// minimal 5.05 KB since a getter prop stays a getter (h(C, { get value() { … } }): the component reads it live; before, it
// was read once and a plugin's editor or a debugger toggle never followed its value; +~40 bytes, measured 5.02 KB)
// core 16.6 KB since shown texts follow the locale in i18n builds (_tr, _trf in core/i18n.ts; +~90 bytes, measured
// 16.59 KB). Only an app built with i18n imports them: minimal and typical unchanged (docs/internal/size-watch.md).
// Measured as a production build (PROD below: development-only code left out, as march build and the CDN build ship it)
// since the list speed work and the h.ts modules (dom/insert, events, tpl, props, component): the same budgets hold.
// core 16.65 KB since components take compiler-ready props (_cp, with the copying path reached only through h(), _c or
// an installed extension: an app made by the compiler no longer bundles it; the site's bench app went 4.88 -> 4.62 KB)
// core 16.7 KB since <For> puts each new row into the page as soon as it is made when no row is reused (+~70 bytes):
// the browser's style, layout and paint work for 1,000 new rows drops ~20% against making them all first.
// core 16.8 KB since a list row is its own owner and the reactive core allocates less per row (an owner keeps one child
// without an array, selector keys share one drop(), delegated event keys are built once; +~65 bytes).
export const BUDGET = { core: 16.8 * 1024, minimal: 5.05 * 1024 };
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const ENTRIES = { core: "src/index.ts", router: "src/router/index.ts", data: "src/data/index.ts", schema: "src/schema/index.ts", ui: "src/ui/index.ts", table: "src/table/index.ts", charts: "src/charts/index.ts" };

// measured as March builds ship (march build, the CDN build): production, development-only code left out
const PROD = { "process.env.NODE_ENV": '"production"', "globalThis.__MARCH_DEV__": "false" };
export async function sizes(names = Object.keys(ENTRIES)) {
  const esbuild = await import("esbuild");
  const out = {};
  for (const n of names) {
    try {
      const r = await esbuild.build({ entryPoints: [resolve(ROOT, ENTRIES[n])], bundle: true, minify: true, format: "esm", write: false, logLevel: "silent", treeShaking: true, define: PROD });
      const code = r.outputFiles[0].contents;
      out[n] = { min: code.length, gzip: gzipSync(code, { level: 9 }).length };
    } catch { /* module missing */ }
  }
  // minimal app: what a counter needs (signals + h + render), after tree shaking
  const r = await esbuild.build({ stdin: { contents: 'export { signal, computed, effect, h, render } from "./src/index.ts";', resolveDir: ROOT }, bundle: true, minify: true, format: "esm", write: false, logLevel: "silent", define: PROD });
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
    const r = await esbuild.build({ entryPoints: [join(dir, "main.tsx")], absWorkingDir: dir, bundle: true, minify: true, format: "esm", write: false, define: PROD,
      outdir: join(dir, "out"), logLevel: "silent", plugins: [march({ components: join(dir, "components") })] });
    const pick = (ext) => r.outputFiles.filter((f) => f.path.endsWith(ext)).map((f) => f.text).join(String.fromCharCode(10));
    const js = pick(".js"), css = pick(".css");
    const gz = (t) => gzipSync(Buffer.from(t), { level: 9 }).length;
    return { js, css, jsGzip: gz(js), cssGzip: gz(css) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
export const BUTTON_APP = `import "march/css/tokens.css";
import { render, h } from "march";
import { Button } from "march/ui";
render(() => h(Button, { variant: "primary" }, "Merhaba"), document.body);
`;
/**
 * A typical small app (what most users ship first): signals, a keyed list, a condition and one component, written the
 * way the docs show it (JSX through the March plugin). Its JS gzip is the size that matters to an app, not the barrel.
 */
export const TYPICAL_APP = `import { render, signal, For, If } from "march";
import { Button } from "march/ui";
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
// typicalJs 9.25 KB: TYPICAL_APP measured 9.13 KB (h.ts is most of it: every prop kind setProp knows ships with it; Button
// carries the link variant, pressed, pill and external links: about 0.2 KB). buttonJs 7.75 KB: measured 7.51 KB. Both
// grew ~1.4 KB when Button's busy ring became the Spinner component itself (a part MarchIDE's Hierarchy lists and
// m:parts={{ Spinner: … }} reaches): Spinner brings i18n (its default "Loading" label) and the colour lists
// typicalJs 9.3 KB since a computation's sources are kept in exact-size arrays (a push onto a one-element array allocates
// room for 17: ~5% less memory for 1,000 list rows; +15 bytes).
export const APP_BUDGET = { buttonJs: 7.75 * 1024, buttonCss: 5.5 * 1024, typicalJs: 9.3 * 1024 };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await sizes();
  const app = await buildApp(TYPICAL_APP);
  s.typical = { min: app.js.length, gzip: app.jsGzip };
  console.log("entry      min KB   gzip KB");
  for (const [n, v] of Object.entries(s)) console.log(`${n.padEnd(10)} ${(v.min / 1024).toFixed(1).padStart(6)}   ${(v.gzip / 1024).toFixed(2).padStart(7)}${BUDGET[n] ? `   (budget ${(BUDGET[n] / 1024).toFixed(2)} KB)` : ""}`);
}
