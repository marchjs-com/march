// The CDN's stylesheets in one order for the whole package (tools/build-cdn.js). A page that loads March from the CDN
// links the stylesheets of the entries it uses, each when its module loads, so their order on the page is the order the
// modules happen to load in. With one stylesheet per entry holding its whole closure, a later entry brought the rules
// of what it is made of back after an earlier entry's own rules: StatsBand's `.m-stats { display: grid }` lost to
// Reveal's `.m-reveal-box { display: block }` (the same specificity, Reveal's link later), and the stats stood in a
// column. So every source stylesheet is a sheet of its own (s/<rank>.css), linked once, in the package's order: what a
// module imports comes before the module's own rules, as an app's rules come after March's.
//   cssOrder(metafile, roots)   every source stylesheet, the ones a module depends on first
//   entrySheets(metafile, out)  per entry module (its output file), the source stylesheets its closure has
import { relative } from "node:path";

const isCss = (p) => p.endsWith(".css");

/**
 * Every stylesheet of an esbuild metafile in dependency order: a JS module's static imports first (depth first), then
 * the stylesheets it imports itself; its lazy imports after its whole static closure; a stylesheet's @import before it.
 * @param {{ inputs: Record<string, { imports?: { path: string, kind: string, external?: boolean }[] }> }} metafile
 * @param {string[]} roots  metafile input paths of the entries, in the order they are given
 * @returns {string[]}
 */
export function cssOrder(metafile, roots) {
  const order = [], seen = new Set();
  // a stylesheet several modules import (Menu's, which Tooltip and Combobox import too) comes after what each of them
  // imports: wherever it is first reached, it stays after the components its own component is made of
  const importers = new Map();
  for (const [k, inp] of Object.entries(metafile.inputs)) {
    if (isCss(k)) continue;
    for (const i of inp.imports ?? []) if (isCss(i.path)) (importers.get(i.path) ?? importers.set(i.path, []).get(i.path)).push(k);
  }
  const statics = (k) => (metafile.inputs[k]?.imports ?? []).filter((i) => !i.external && metafile.inputs[i.path] && !isCss(i.path) && i.kind !== "dynamic-import");
  const visit = (k) => {
    if (seen.has(k)) return;
    seen.add(k);
    const imps = (metafile.inputs[k]?.imports ?? []).filter((i) => !i.external && metafile.inputs[i.path]);
    if (isCss(k)) {
      for (const m of importers.get(k) ?? []) for (const i of statics(m)) visit(i.path);
      for (const i of imps) if (isCss(i.path)) visit(i.path);
      order.push(k);
      return;
    }
    for (const i of imps) if (!isCss(i.path) && i.kind !== "dynamic-import") visit(i.path);
    for (const i of imps) if (isCss(i.path)) visit(i.path);
    for (const i of imps) if (!isCss(i.path) && i.kind === "dynamic-import") later.push(i.path);
  };
  // a lazy import is not part of the module: it is ordered once the static closure is done, never inside it (where a
  // module it imports would come before the module that statically imports it)
  const later = [];
  for (const r of roots) { visit(r); while (later.length) visit(later.shift()); }
  // a stylesheet no root reaches (none expected): last, in name order
  for (const k of Object.keys(metafile.inputs).sort()) if (isCss(k)) visit(k);
  return order;
}

/**
 * The source stylesheets of each entry's closure: entry output (relative to `out`, without .js) → metafile input paths.
 * @param {{ outputs: Record<string, { entryPoint?: string, cssBundle?: string, inputs: Record<string, unknown> }> }} metafile
 * @param {string} out  the version folder, relative to the build's working directory
 */
export function entrySheets(metafile, out) {
  const map = new Map();
  for (const [file, o] of Object.entries(metafile.outputs)) {
    if (!o.entryPoint || !o.cssBundle || !file.endsWith(".js")) continue;
    const name = relative(out, file).split("\\").join("/").replace(/\.js$/, "");
    map.set(name, Object.keys(metafile.outputs[o.cssBundle]?.inputs ?? {}).filter(isCss));
  }
  return map;
}

/** A stylesheet's own rules, without the @import rules (each imported stylesheet is a sheet of its own, linked before it). */
export const ownRules = (minified) => minified.replace(/@import\s*(?:url\()?\s*(["'])[^"']*\1\s*\)?[^;]*;/g, "").trim();
