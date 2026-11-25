// March bundled without code splitting (a widget or a library in one file): every browser entry, all its names imported
// by name as an app would, through March's esbuild plugin. A module March imports lazily somewhere is wrapped by
// esbuild (its init runs on first use); where it is also imported statically, the bundle must run that init when it
// loads. In a side-effect free package esbuild may drop it (Drawer from march/ui: "edgeOf is not a function"), so the
// plugin treats March's files as having side effects in such builds (compiler/esbuild.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { march } from "../compiler/esbuild.js";
import { entryNames } from "../compiler/cdn.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const SKIP = new Set(["./testing", "./compiler", "./esbuild", "./register"]);
const ENTRIES = Object.entries(pkg.exports).filter(([k, v]) => typeof v === "string" && /\.(ts|tsx|js)$/.test(v) && !k.includes("*") && !SKIP.has(k) && !v.startsWith("./compiler"));

const reexporting = new Map();
/** A module that re-exports (export … from): it keeps no code of its own, yet what it re-exports is reached through it. */
const reexports = (f) => {
  if (!reexporting.has(f)) { let t = ""; try { t = readFileSync(join(ROOT, f), "utf8"); } catch { /* virtual */ } reexporting.set(f, /^export (\*|\{[^}]*\}) from|^export \* as /m.test(t)); }
  return reexporting.get(f);
};
/** The modules static imports reach from the entry, through the modules the bundle keeps and the re-exporting ones. */
function reached(meta) {
  const kept = Object.values(meta.outputs)[0]?.inputs ?? {};
  const seen = new Set(), stack = ["<stdin>"];
  while (stack.length) {
    const f = stack.pop(); if (seen.has(f)) continue; seen.add(f);
    if (f !== "<stdin>" && !(kept[f]?.bytesInOutput > 0) && !reexports(f)) continue;
    for (const im of meta.inputs[f]?.imports ?? []) if (im.kind === "import-statement" && !im.external) stack.push(im.path);
  }
  return seen;
}
/** The wrapped modules (esbuild's __esm) a bundle never initializes when it loads, while code that runs uses what they
 *  declare. Unminified output: a wrapper ends at the first line that is exactly "});", a module's code is headed by
 *  "// <path>", a lazy import is `(init_x(), x_exports)`. */
export function uninitialized(code) {
  const starts = [...code.matchAll(/var (init_[\w$]+) = __esm\(\{\s*"([^"]+)"\(\) \{/g)].map((m) => ({ name: m[1], path: m[2], at: m.index, end: 0 }));
  for (const s of starts) { const e = code.indexOf("\n});\n", s.at); s.end = e < 0 ? code.length : e + 5; }
  const calls = (text) => [...text.matchAll(/(init_[\w$]+)\(\)(,\s*[\w$]+_exports\))?/g)].filter((m) => !m[2]).map((m) => m[1]);
  let top = code;
  for (let i = starts.length - 1; i >= 0; i--) top = top.slice(0, starts[i].at) + top.slice(starts[i].end);
  const edges = new Map(starts.map((s) => [s.name, calls(code.slice(s.at, s.end)).filter((n) => n !== s.name)]));
  const queue = calls(top), ran = new Set();
  while (queue.length) { const n = queue.pop(); if (ran.has(n)) continue; ran.add(n); queue.push(...(edges.get(n) ?? [])); }
  const never = new Set(starts.filter((s) => !ran.has(s.name)).map((s) => s.path));
  const heads = [...code.matchAll(/^\/\/ (\S+)$/gm)].map((m) => ({ path: m[1], at: m.index }));
  const sections = heads.map((h, i) => ({ path: h.path, text: code.slice(h.at, i + 1 < heads.length ? heads[i + 1].at : code.length) }));
  const declared = (t) => [...t.matchAll(/^(?:async )?function\*? ([\w$]+)|^class ([\w$]+)|^var ([\w$, ]+)[;=]/gm)]
    .flatMap((m) => (m[3] ? m[3].split(",").map((x) => x.trim().split(" ")[0]) : [m[1] ?? m[2]])).filter((x) => x && !/^init_|_exports$/.test(x));
  const live = sections.filter((s) => !never.has(s.path)).map((s) => s.text).join("\n");
  return sections.filter((s) => never.has(s.path) && !/\.css$/.test(s.path))
    .filter((s) => declared(s.text).some((n) => new RegExp(`(^|[^\\w$.])${n.replace(/\$/g, "\\$")}(?![\\w$])`).test(live)))
    .map((s) => s.path);
}

test("without code splitting, every module a bundle of a March entry uses is initialized when it loads", async () => {
  const plugin = march({ dev: false, cssSplit: false });
  const bad = [];
  for (const [k, v] of ENTRIES) {
    const names = entryNames(join(ROOT, v)).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
    if (!names.length) continue;
    const contents = `import { ${names.map((n, i) => `${n} as x${i}`).join(", ")} } from ${JSON.stringify(v)};\nglobalThis.__keep = [${names.map((_, i) => `x${i}`).join(", ")}];\n`;
    const r = await esbuild.build({ stdin: { contents, resolveDir: ROOT, loader: "js" }, bundle: true, format: "esm", platform: "browser", target: "es2022",
      write: false, splitting: false, outdir: join(ROOT, ".no-split"), minify: false, metafile: true, logLevel: "silent", plugins: [plugin] });
    const seen = reached(r.metafile);
    const left = uninitialized(r.outputFiles.find((f) => f.path.endsWith(".js")).text).filter((p) => seen.has(p));
    if (left.length) bad.push(`${k}: ${left.join(", ")}`);
  }
  assert.deepEqual(bad, [], "modules left uninitialized in a bundle without splitting");
});

test("the check finds the problem: without the plugin's fix, Drawer from march/ui is left uninitialized", async () => {
  const r = await esbuild.build({ stdin: { contents: 'import { Drawer } from "./src/ui/index.ts";\nglobalThis.__keep = [Drawer];\n', resolveDir: ROOT, loader: "js" },
    bundle: true, format: "esm", platform: "browser", target: "es2022", write: false, splitting: false, outdir: join(ROOT, ".no-split"), minify: false, metafile: true,
    logLevel: "silent", plugins: [march({ dev: false, cssSplit: false, noSplitEffects: false })] });
  const seen = reached(r.metafile);
  assert.ok(uninitialized(r.outputFiles.find((f) => f.path.endsWith(".js")).text).filter((p) => seen.has(p)).includes("src/components/overlays/drawer/index.ts"),
    "Drawer is initialized without the fix: either this check no longer sees the problem, or esbuild fixed it (then the plugin's noSplitEffects can go)");
});
