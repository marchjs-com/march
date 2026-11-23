// March from the CDN (march.config.js › cdn): an app's own code is bundled, March is not. Every `march/*` import
// becomes an import of that entry's file on cdn.marchjs.com (one URL per entry: a browser loads each module once and
// the entries share their chunks there), and the entry's stylesheet is linked next to it. A page downloads the entries
// it uses, nothing of March is in the app's files.
//   cdn: "https://cdn.marchjs.com/0.3.10"   a version's folder (immutable: cached for a year, every file the same
//                                           release; latest/ would mix two releases in one page when it moves on)
// The build reads the version's importmap.json (entry → file) and sizes.json (each entry's size on top of the core and
// whether it has a stylesheet). A named import from a barrel goes to the smallest entry that exports the same thing:
// `import { Button } from "march/ui"` loads march/components/actions/button (6 KB), not march/ui (430 KB).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { exportMap, statementStarts } from "./deep-imports.js";

/**
 * The version folder's importmap.json and sizes.json, kept in `cacheDir` (a version's files never change).
 * @param {string} base  e.g. "https://cdn.marchjs.com/0.3.10"
 * @param {string} [cacheDir]
 * @returns {Promise<{ base: string, url: Record<string, string>, size: Record<string, number>, css: Record<string, string>, core: string[] }>}
 */
export async function loadCdn(base, cacheDir) {
  base = base.replace(/\/+$/, "");
  const get = async (name) => {
    const file = cacheDir && !/\/latest$/.test(base) ? join(cacheDir, base.replace(/^https?:\/\//, "").replace(/[^\w.-]+/g, "_"), name) : null;
    if (file && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
    const res = await fetch(`${base}/${name}`);
    if (!res.ok) throw new Error(`cdn: ${base}/${name}: ${res.status}`);
    const text = await res.text();
    if (file) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); }
    return JSON.parse(text);
  };
  const [map, sizes] = await Promise.all([get("importmap.json"), get("sizes.json")]);
  const url = {}, size = {}, css = {};
  for (const [spec, u] of Object.entries(map.imports ?? {})) {
    // the map's URLs point at the folder it was published for (latest/ or the version): use the one asked for
    url[spec] = `${base}/${u.replace(/^.*?\/(latest|\d+\.\d+\.\d+[\w.-]*)\//, "")}`;
    const e = sizes.entries?.[spec];
    size[spec] = spec === "march" ? 0 : e?.added ?? Infinity;
    if (e?.css) css[spec] = url[spec].replace(/\.js$/, ".css");
  }
  // the core's files (every page loads them): index.html announces them up front
  const core = (sizes.core?.files ?? []).map((f) => `${base}/${f}`);
  return { base, url, size, css, core };
}

/**
 * For each exported name of a barrel, the smallest CDN entry that exports the same binding.
 * @param {{ url: Record<string, string>, size: Record<string, number> }} cdn
 * @param {Record<string, string>} files  entry → its source file in this copy of March
 * @returns {(spec: string, name: string) => string}  the entry to import `name` from (`spec` when none is smaller)
 */
export function cdnTargets(cdn, files) {
  /** defining file + name → the smallest entry that exports it */
  let best = null;
  const index = () => {
    best = new Map();
    for (const [spec, file] of Object.entries(files)) {
      if (!(spec in cdn.url) || spec.startsWith("march/icons/") || !existsSync(file)) continue;
      for (const [name, def] of exportMap(file)) {
        const k = `${def}\0${name}`, cur = best.get(k);
        if (!cur || cdn.size[spec] < cdn.size[cur]) best.set(k, spec);
      }
    }
  };
  return (spec, name) => {
    if (!best) index();
    const file = files[spec];
    const def = file && exportMap(file).get(name);
    return (def && best.get(`${def}\0${name}`)) ?? spec;
  };
}

/** Rewrite named imports from March entries (static, and `import("x").then((m) => m.Name)`) to their smallest entry. */
export function cdnImports(code, target) {
  if (!code.includes("march")) return code;
  // only real import statements: the same text in a string or a comment (a code sample in a demo) stays as written
  const live = statementStarts(code);
  code = code.replace(/import\s*\{([^}]*)\}\s*from\s*(["'])(march(?:\/[\w-]+)*)\2\s*;?/g, (all, list, q, spec, at) => {
    if (!live.has(at)) return all;
    const groups = new Map();
    for (const part of list.split(",")) {
      const p = part.trim();
      if (!p) continue;
      const to = p.startsWith("type ") ? spec : target(spec, p.split(/\s+as\s+/)[0].trim());
      (groups.get(to) ?? groups.set(to, []).get(to)).push(p);
    }
    if (groups.size === 1 && groups.has(spec)) return all;
    return [...groups].map(([s, names]) => `import { ${names.join(", ")} } from ${JSON.stringify(s)};`).join(" ");
  });
  if (!code.includes("import(")) return code;
  const dyn = statementStarts(code, true);
  return code.replace(/import\(\s*(["'])(march(?:\/[\w-]+)*)\1\s*\)(\s*\.then\(\s*\(?\s*([\w$]+)\s*\)?\s*=>\s*(?:\(\s*\{\s*[\w$]+:\s*)?\4\.([\w$]+))/g, (all, q, spec, rest, m, name, at) => {
    if (!dyn.has(at)) return all;
    const to = target(spec, name);
    return to === spec ? all : `import(${JSON.stringify(to)})${rest}`;
  });
}

/** The value names an entry file exports (types aside): `export *` from an external module names nothing to esbuild. */
export function entryNames(file) {
  const names = new Set(exportMap(file).keys());
  try { for (const m of readFileSync(file, "utf8").matchAll(/export\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from/g)) names.add(m[1]); } catch { /* none */ }
  return [...names].sort();
}

/**
 * The module an entry import resolves to: the entry's file on the CDN (left to the browser) and its stylesheet, linked
 * before the app's own stylesheets (so an app's rules win, as in a bundle) and awaited: no flash of unstyled content.
 * `local` (prerender, in node): the entry's source instead, and the link without waiting.
 * @param {string} spec @param {{ url: Record<string, string>, css: Record<string, string> }} cdn
 * @param {string | null} local @param {string[]} names  what the entry exports
 */
export function cdnModule(spec, cdn, local, names = []) {
  const css = cdn.css[spec];
  const from = JSON.stringify(local ?? cdn.url[spec]);
  const re = local || !names.length ? `export * from ${from};` : `export { ${names.join(", ")} } from ${from};`;
  if (!css) return re;
  return `${re}
import { cdnCss } from "march-cdn:css";
${local ? "" : "await "}cdnCss(${JSON.stringify(css)});`;
}

/**
 * A lazy import of an entry (`import("march/x")`): the CDN file itself, with its stylesheet loaded alongside (no module
 * of the app's own in between, which would be one more small chunk and one more request per lazy entry).
 * `local` (prerender): the entry's source file.
 * @param {string} code @param {{ url: Record<string, string>, css: Record<string, string> }} cdn
 * @param {Record<string, string> | null} local  entry → source file
 */
export function cdnDynamic(code, cdn, local) {
  if (!code.includes("import(")) return code;
  const calls = statementStarts(code, true);
  let used = false;
  const out = code.replace(/import\(\s*(["'])(march(?:\/[\w-]+)*)\1\s*\)/g, (all, q, spec, at) => {
    // a type (`typeof import("march/x")`) stays: TypeScript erases it
    if (!calls.has(at) || !(spec in cdn.url) || /typeof\s*$/.test(code.slice(Math.max(0, at - 20), at))) return all;
    const file = local ? local[spec] : cdn.url[spec];
    if (!file) return all;
    const imp = `import(${JSON.stringify(file.split("\\").join("/"))})`;
    if (!cdn.css[spec]) return imp;
    used = true;
    return `__mCdnLazy(${imp}, ${JSON.stringify(cdn.css[spec])})`;
  });
  return used ? `import { cdnLazy as __mCdnLazy } from "march-cdn:css";\n${out}` : out;
}

/** A stylesheet of the package (`import "march/css/tokens.css"`): linked from the CDN. */
export const cdnStylesheet = (href, local) => `import { cdnCss } from "march-cdn:css";\n${local ? "" : "await "}cdnCss(${JSON.stringify(href)});`;

/** The link helper the entry modules share (one <link> per URL; a prerendered page already has it in <head>). */
export const CDN_CSS = `const seen = new Map();
export function cdnCss(href) {
  if (typeof document === "undefined") return;
  if (seen.has(href)) return seen.get(href);
  const head = document.head;
  let l = [...head.querySelectorAll("link")].find((x) => x.getAttribute("href") === href);
  if (!l) {
    l = document.createElement("link");
    l.setAttribute("rel", "stylesheet");
    l.setAttribute("href", href);
    l.setAttribute("data-march-cdn", "");
    // CORS (the CDN allows any origin): its rules readable from the page (theme-paint copies them)
    l.setAttribute("crossorigin", "anonymous");
    // after the other CDN stylesheets, before the app's own
    const first = [...head.children].find((x) => (x.tagName === "STYLE" || (x.tagName === "LINK" && x.getAttribute("rel") === "stylesheet")) && !x.hasAttribute("data-march-cdn"));
    head.insertBefore(l, first ?? null);
  }
  const p = l.sheet ? Promise.resolve() : new Promise((r) => { l.addEventListener("load", r); l.addEventListener("error", r); setTimeout(r, 4000); });
  seen.set(href, p);
  return p;
}
export const cdnLazy = (mod, href) => Promise.all([mod, cdnCss(href)]).then(([m]) => m);
`;
