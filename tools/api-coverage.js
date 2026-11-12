#!/usr/bin/env node
// Every exported runtime API is explained in the showcase. One source: the JSDoc summary on the declaration (the same
// text editors show on hover). This tool writes examples/showcase/src/api.gen.ts — every package.json "exports"
// subpath, each runtime export with its kind and summary — which the showcase "API başvurusu" renders (İlk Adımlar).
//   node tools/api-coverage.js            write api.gen.ts (+ its lazy data parts), list exports without a summary
//   node tools/api-coverage.js --check    exit 1 when api.gen.ts is stale or an export has no summary
// test/api-coverage.test.js runs the check.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT = "examples/showcase/src/api.gen.ts";
/** Raw bytes of data per lazy part at most (~50 KB of text is ~18 KB gzip: over the 10 KB part floor, under the 25 KB budget). */
const PART_BYTES = 55_000;
const cache = new Map();
const read = (p) => { if (!cache.has(p)) cache.set(p, existsSync(p) ? readFileSync(p, "utf8") : ""); return cache.get(p); };
const DECL = String.raw`(?:export\s+)?(?:declare\s+)?(?:async\s+)?(function\*?|const|let|var|class|enum)\s+`;
const esc = (s) => s.replace(/[$]/g, "\\$&");

/** Runtime exports of a module: name → { file, local } where `local` is the declared name in that file. */
export function runtimeExports(file, seen = new Set()) {
  const out = new Map();
  if (seen.has(file) || !existsSync(file)) return out;
  seen.add(file);
  const src = read(file).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/^\s*\/\/.*$/gm, "");
  for (const m of src.matchAll(/^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|enum)\s+([A-Za-z_$][\w$]*)/gm)) out.set(m[1], { file, local: m[1] });
  for (const m of src.matchAll(/^export\s+(?!type\b)\{([^}]*)\}(?:\s*from\s*["']([^"']+)["'])?/gm)) {
    const from = m[2] ? resolve(dirname(file), m[2]) : null;
    for (const part of m[1].split(",")) {
      const p = part.trim();
      if (!p || p.startsWith("type ")) continue;
      const [orig, alias] = p.split(/\s+as\s+/).map((s) => s.trim());
      const name = alias ?? orig;
      if (name === "default") continue;
      if (from) out.set(name, runtimeExports(from, new Set()).get(orig) ?? { file: from, local: orig });
      else out.set(name, imported(file, src, orig) ?? { file, local: orig });
    }
  }
  for (const m of src.matchAll(/^export\s+\*\s+from\s+["']([^"']+)["']/gm)) {
    for (const [n, v] of runtimeExports(resolve(dirname(file), m[1]), seen)) if (!out.has(n)) out.set(n, v);
  }
  return out;
}

/** `export { x }` of a name the file imports: where x really lives. */
function imported(file, src, local) {
  if (new RegExp(String.raw`^` + DECL + esc(local) + String.raw`\b`, "m").test(src)) return null;
  for (const m of src.matchAll(/^import\s+(?!type\b)\{([^}]*)\}\s*from\s*["']([^"']+)["']/gm)) {
    for (const part of m[1].split(",")) {
      const [orig, alias] = part.trim().split(/\s+as\s+/).map((s) => s.trim());
      if ((alias ?? orig) !== local) continue;
      const from = resolve(dirname(file), m[2]);
      return runtimeExports(from, new Set()).get(orig) ?? { file: from, local: orig };
    }
  }
  return null;
}

/** The JSDoc summary (first sentence) and kind of a declaration. */
export function describe({ file, local }) {
  const src = read(file);
  // top-level declaration (no indentation: a nested helper of the same name does not count)
  const m = new RegExp(String.raw`(?:/\*\*((?:(?!\*/)[\s\S])*)\*/\s*)?^` + DECL + esc(local) + String.raw`\b(.{0,60})`, "m").exec(src);
  if (!m) return { kind: "const", summary: "" };
  const head = m[3] ?? "";
  const kind = m[2].startsWith("function") ? (/^[A-Z]/.test(local) ? "component" : "function")
    : m[2] === "class" ? "class" : /^\s*(?::[^=]*)?=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*(?::[^=]*)?=>/.test(head) ? (/^[A-Z]/.test(local) ? "component" : "function") : "const";
  // JSDoc, else the // comment lines right above the declaration
  const lines = [];
  for (const l of src.slice(0, m.index).split("\n").reverse().slice(1)) { const c = /^\s*\/\/\s?(.*)$/.exec(l); if (!c) break; lines.unshift(c[1]); }
  const doc = (m[1] ?? lines.join("\n")).split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim()).filter((l) => l && !l.startsWith("@")).join(" ").trim();
  const summary = doc.replace(/\{@link\s+([^}]+)\}/g, "$1").replace(/\s+/g, " ");
  return { kind, summary: summary.length > 220 ? summary.slice(0, 217).replace(/\s+\S*$/, "") + " …" : summary };
}

/** Summary of a manager's standard trio, from the folder name (src/managers/<folder>/). */
function managerSummary(name, file) {
  const label = file.split("/")[2].replace(/-/g, " ");
  if (/^configure[A-Z]/.test(name)) return `Global options of the ${label} manager (a live instance restarts with them).`;
  if (/^dispose[A-Z]/.test(name)) return `Shut the ${label} manager down (listeners removed); the next use starts it again.`;
  if (/Manager$/.test(name)) return `The ${label} manager itself: get(), configure(), dispose(), alive().`;
  return "";
}

/** Subpaths with their runtime exports (CSS, compiler and testing entries are tools, not app APIs). */
export function packageApis(root = ROOT) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const out = [];
  for (const [sub, target] of Object.entries(pkg.exports)) {
    if (typeof target !== "string" || sub.includes("*") || !/\.(ts|js)$/.test(target)) continue;
    if (/^\.\/(compiler|esbuild|register|testing)$/.test(sub)) continue;
    const names = [...runtimeExports(join(root, target))].sort(([a], [b]) => a.localeCompare(b));
    out.push({
      subpath: sub === "." ? "hadi-march" : `hadi-march/${sub.slice(2)}`,
      items: names.map(([name, at]) => {
        const file = relative(root, at.file).replace(/\\/g, "/");
        // single icons: one SVG path set each, shown on the Icons page; their summary is their name
        if (file.startsWith("src/icons/glyphs/")) return { name, kind: "icon", summary: `Icon: ${name}`, file };
        const d = describe(at);
        // the manager pattern (defineManager): configureX / disposeX / xManager say the same thing for every manager
        const mgr = file.startsWith("src/managers/") && !d.summary && managerSummary(name, file);
        return { name, ...d, ...(mgr ? { summary: mgr } : {}), file };
      }),
    });
  }
  return out;
}

/** The generated files. A name re-exported by several subpaths is described once, under its first subpath, and listed
 *  as "also in" there. The data is split into balanced lazy parts (each under the part budget); loadApi() loads them. */
export function generate(root = ROOT) {
  const apis = packageApis(root);
  const first = new Map();
  for (const a of apis) for (const i of a.items) { const k = `${i.file}#${i.name}`; if (!first.has(k)) first.set(k, a.subpath); }
  // icons are one name each: a space-separated list per subpath keeps the parts small
  const rows = apis.map((a) => {
    const own = a.items.filter((i) => first.get(`${i.file}#${i.name}`) === a.subpath);
    return {
      subpath: a.subpath,
      items: own.filter((i) => i.kind !== "icon").map((i) => [i.name, i.kind, i.summary,
        apis.filter((b) => b.subpath !== a.subpath && b.items.some((j) => j.name === i.name && j.file === i.file)).map((b) => b.subpath)]),
      ...(own.some((i) => i.kind === "icon") ? { icons: own.filter((i) => i.kind === "icon").map((i) => i.name).join(" ") } : {}),
    };
  }).filter((a) => a.items.length || a.icons);
  // balanced parts: a big subpath may be cut between two parts (loadApi joins the pieces back by subpath)
  const total = rows.reduce((s, r) => s + JSON.stringify(r).length, 0);
  const n = Math.max(1, Math.ceil(total / PART_BYTES));
  const parts = Array.from({ length: n }, () => []);
  let acc = 0;
  const at = () => Math.min(n - 1, Math.floor(acc / (total / n)));
  for (const r of rows) {
    let piece = { subpath: r.subpath, items: [] };
    acc += JSON.stringify({ subpath: r.subpath, items: [], ...(r.icons ? { icons: r.icons } : {}) }).length;
    let part = at();
    for (const item of r.items) {
      acc += JSON.stringify(item).length + 1;
      if (at() !== part) { if (piece.items.length) parts[part].push(JSON.stringify(piece)); piece = { subpath: r.subpath, items: [] }; part = at(); }
      piece.items.push(item);
    }
    if (r.icons) piece.icons = r.icons;
    parts[part].push(JSON.stringify(piece));
  }
  const HEAD = "// GENERATED by tools/api-coverage.js from the JSDoc of every package export — do not edit.\n";
  const files = {};
  files[OUT] = HEAD +
    "/** [name, kind, summary, also exported by]. */\n" +
    'export type ApiItem = [name: string, kind: "component" | "function" | "class" | "const" | "icon", summary: string, also: string[]];\n' +
    "/** One subpath; `icons`: its single icons, space-separated. */\n" +
    "export interface ApiGroup { subpath: string; items: ApiItem[]; icons?: string }\n" +
    `/** Every subpath in package order (${n} lazy part${n > 1 ? "s" : ""}). */\n` +
    `export const loadApi = (): Promise<ApiGroup[]> => Promise.all([${parts.map((_, i) => `import("./api.gen.${i + 1}.ts")`).join(", ")}]).then((m) => m.flatMap((x) => x.default).reduce<ApiGroup[]>((out, g) => { const last = out[out.length - 1]; if (last?.subpath === g.subpath) { last.items.push(...g.items); if (g.icons) last.icons = g.icons; } else out.push({ ...g, items: [...g.items] }); return out; }, []));\n`;
  parts.forEach((p, i) => {
    files[OUT.replace(/\.ts$/, `.${i + 1}.ts`)] = HEAD + 'import type { ApiGroup } from "./api.gen.ts";\n' + `const groups: ApiGroup[] = [\n${p.join(",\n")}];\nexport default groups;\n`;
  });
  const missing = apis.flatMap((a) => a.items.filter((i) => !i.summary).map((i) => `${a.subpath} › ${i.name}  (${i.file})`));
  return { files, missing: [...new Set(missing)], count: rows.reduce((s, a) => s + a.items.length, 0) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const { files, missing, count } = generate();
  let stale = false;
  for (const [rel, text] of Object.entries(files)) {
    const p = join(ROOT, rel);
    if ((existsSync(p) ? readFileSync(p, "utf8") : "") === text) continue;
    stale = true;
    if (check) console.error(`✖ ${rel} is out of date: run node tools/api-coverage.js`);
    else { writeFileSync(p, text); console.log(`✔ ${rel}`); }
  }
  for (const m of missing) console.error(`✖ no JSDoc summary: ${m}`);
  if (check && (stale || missing.length)) process.exit(1);
  console.log(`${count} exports, ${missing.length} without a summary`);
}
