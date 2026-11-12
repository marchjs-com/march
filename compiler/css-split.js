// "Only what you use is bundled" for CSS. March components import their own stylesheet (`import "./button.css"`), but
// esbuild adds the CSS of every module it reaches, even through a barrel (`hadi-march/ui`) whose exports are unused.
// So the March plugin takes those imports out of esbuild's hands and, after the build, gives each output JS file the CSS
// of the March modules whose code actually landed in it (metafile bytesInOutput > 0):
//   - initial entry → appended to its CSS bundle (linked from index.html; a bundle is created when missing)
//   - lazy chunks and shared chunks → their own .css next to the .js, loaded by a few lines prepended to the chunk that
//     add a <link rel="stylesheet"> and wait for it (top-level await: no flash of unstyled content; CSP style-src 'self')
// CSS already in the initial bundle is not repeated in chunks. Order follows ORDER (the cascade the components expect).
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname, basename, relative, sep } from "node:path";
import { MARCH_ROOT } from "./autoimports.js";

const SRC = join(MARCH_ROOT, "src");
/** Cascade order of component stylesheets (later wins on equal specificity). Others follow alphabetically. */
export const ORDER = [
  "ui/field.css", "ui/button.css", "ui/menu.css", "ui/dialog.css", "ui/toast.css", "ui/tabs.css", "ui/display.css", "ui/grid.css", "ui/layout.css", "ui/nav.css",
  "ui/sidebar.css", "ui/palette.css", "ui/theme.css", "ui/accent.css", "dom/lazy.css", "ui/overlay.css", "ui/theme-swatches.css", "ui/media.css", "ui/disclosure.css", "ui/app.css", "ui/chip.css", "ui/marquee.css", "ui/avatar-group.css",
  "ui/progress.css", "ui/rating.css", "ui/accordion.css", "ui/steps.css", "ui/pagination.css", "ui/carousel.css", "ui/tree.css", "ui/kanban.css",
  "ui/splitter.css", "forms/form.css", "forms/inputs.css", "forms/choice.css", "forms/pickers.css", "forms/date.css", "forms/file.css", "forms/editors.css",
  "forms/wizard.css", "forms/records.css", "css/table.css", "charts/charts.css", "fx/fx.css",
];
const rank = (abs) => { const r = relative(SRC, abs).split(sep).join("/"); const i = ORDER.indexOf(r); return i < 0 ? ORDER.length : i; };
const isMarchModule = (p) => !!p && p.startsWith(SRC + sep) && /\.(ts|tsx|js|jsx)$/.test(p);
/** A stylesheet with its relative @imports inlined (each file once). */
function inlined(file, seen = new Set()) {
  if (seen.has(file)) return "";
  seen.add(file);
  return readFileSync(file, "utf8").replace(/@import\s+(?:url\()?["']([^"']+)["']\)?\s*;/g, (m, p) => (/^(https?:|\/\/)/.test(p) ? m : inlined(resolve(dirname(file), p), seen)));
}

/** Plugin part: record `module → stylesheets` and make the CSS imports no-ops for esbuild. */
export function setupCssSplit(build) {
  const own = new Map(); // abs module path → Set(abs css path)
  build.initialOptions.metafile = true;
  const o = build.initialOptions;
  const cwd = o.absWorkingDir ?? process.cwd();
  const entries = new Set([].concat(o.entryPoints ?? []).map((e) => resolve(cwd, typeof e === "string" ? e : e.in)));
  build.onResolve({ filter: /\.css$/ }, (a) => {
    if (a.kind !== "import-statement" || !a.importer || !/\.(ts|tsx|js|jsx|mjs)$/.test(a.importer)) return undefined;
    const css = resolve(a.resolveDir, a.path.startsWith("hadi-march/css/") ? join(SRC, a.path.slice("hadi-march/".length)) : a.path);
    // March components always; app stylesheets imported by modules other than the entry (lazy pages, components) too, so
    // they follow their code as well. Left to esbuild: the entry's own imports and CSS with relative url()s (fonts).
    if (!isMarchModule(a.importer)) {
      if (entries.has(a.importer) || /[\/]node_modules[\/]/.test(a.importer) || !existsSync(css) || /url\(\s*["']?(?!data:|https?:|#)/.test(inlined(css))) return undefined;
    }
    let s = own.get(a.importer);
    if (!s) own.set(a.importer, (s = new Set()));
    s.add(css);
    return { path: css, namespace: "hm-css-split" };
  });
  build.onLoad({ filter: /.*/, namespace: "hm-css-split" }, () => ({ contents: "", loader: "js" }));
  build.onEnd(async (result) => {
    if (result.errors.length || !result.metafile) return;
    await distribute(result, build, own);
  });
}

/** The CSS loader put at the top of a chunk (exported: pack-chunks removes it when it merges that CSS elsewhere). */
export const loaderJs = (file) => `await new Promise((r)=>{if(typeof document==="undefined")return r();const u=new URL(${JSON.stringify(`./${file}`)},import.meta.url).href;if(document.querySelector('link[data-hm-css="'+u+'"]'))return r();const l=document.createElement("link");l.rel="stylesheet";l.href=u;l.dataset.hmCss=u;l.onload=l.onerror=()=>r();document.head.appendChild(l)});\n`;

async function distribute(result, build, own) {
  const o = build.initialOptions;
  const cwd = o.absWorkingDir ?? process.cwd();
  const abs = (p) => resolve(cwd, p);
  const meta = result.metafile;
  const initial = new Set([].concat(o.entryPoints ?? []).map((e) => resolve(cwd, typeof e === "string" ? e : e.in)));
  const memory = result.outputFiles ? new Map(result.outputFiles.map((f) => [f.path, f])) : null;
  const read = async (p) => (memory ? memory.get(p)?.text ?? "" : existsSync(p) ? readFile(p, "utf8") : "");
  const write = async (p, text) => {
    if (!memory) return writeFile(p, text);
    const contents = new TextEncoder().encode(text);
    const f = { path: p, contents, hash: "", get text() { return text; } };
    const i = result.outputFiles.findIndex((x) => x.path === p);
    if (i >= 0) result.outputFiles[i] = f; else result.outputFiles.push(f);
    memory.set(p, f);
  };
  const cssText = new Map();
  const load = async (p) => { if (!cssText.has(p)) cssText.set(p, inlined(p)); return cssText.get(p); };
  const minify = async (text) => (o.minify && build.esbuild ? (await build.esbuild.transform(text, { loader: "css", minify: true, legalComments: "none" })).code : text);

  const jsOutputs = Object.entries(meta.outputs).filter(([f]) => f.endsWith(".js"));
  const wanted = (out) => {
    const set = new Set();
    for (const [input, info] of Object.entries(out.inputs)) {
      if (!info.bytesInOutput) continue;
      for (const c of own.get(abs(input)) ?? []) set.add(c);
    }
    return [...set].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  };
  const isInitial = (out) => !!out.entryPoint && initial.has(abs(out.entryPoint));
  const inInitial = new Set();
  // initial entries first (their CSS is linked from the page), then the rest
  for (const [file, out] of jsOutputs.filter(([, x]) => isInitial(x))) {
    const list = wanted(out);
    list.forEach((c) => inInitial.add(c));
    if (!list.length) continue;
    const body = (await Promise.all(list.map(load))).join("\n");
    const target = out.cssBundle ? abs(out.cssBundle) : abs(file).replace(/\.js$/, ".css");
    await write(target, (await read(target)) + (await minify(body)));
    if (!out.cssBundle) { out.cssBundle = relative(cwd, target).split(sep).join("/"); meta.outputs[out.cssBundle] = { bytes: 0, inputs: {}, imports: [], exports: [] }; }
  }
  for (const [file, out] of jsOutputs.filter(([, x]) => !isInitial(x))) {
    const list = wanted(out).filter((c) => !inInitial.has(c));
    const existing = out.cssBundle ? abs(out.cssBundle) : null;
    if (!list.length && !existing) continue;
    const target = existing ?? abs(file).replace(/\.js$/, ".css");
    if (list.length) await write(target, (await read(target)) + (await minify((await Promise.all(list.map(load))).join("\n"))));
    const js = abs(file);
    const rel = relative(dirname(js), target).split(sep).join("/");
    await write(js, loaderJs(rel) + (await read(js)));
    if (!existing) { out.cssBundle = relative(cwd, target).split(sep).join("/"); meta.outputs[out.cssBundle] = { bytes: 0, inputs: {}, imports: [], exports: [] }; }
  }
}

