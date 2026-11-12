// After `march build` (and mergeEntry): fold very small shared chunks into a bigger chunk that is always loaded
// wherever the small one is needed, so a page needs fewer requests and the build has fewer files.
//
// esbuild splits shared code by "which entry points reach this file"; with many pages and lazy parts that leaves dozens
// of 100–2000 byte chunks. A small chunk T is folded into a chunk B only when it is safe and free:
//   - every entry that loads T also loads B (reach(B) ⊇ reach(T))      → nobody gets an extra request
//   - everything T imports is already loaded with B (deps(T) ⊆ closure(B)) → no new downloads
//   - no module that imports T is inside B's static closure              → no new import cycle (evaluation order kept)
//   - T has no CSS loader (component CSS keeps following its own chunk)
// Entry stubs (`export { x as a } from "../main.js"`, left by mergeEntry) are removed: their importers import from the
// entry directly. The extra bytes a fold costs (pages that load B but did not need T) are kept small by choosing the B
// with the fewest such pages. Names are fixed afterwards by rehashOutputs.
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const posix = (p) => p.split(sep).join("/");
const rel = (fromFile, toFile) => { const r = posix(relative(dirname(fromFile), toFile)); return r.startsWith(".") ? r : `./${r}`; };
const base = (k) => k.split("/").pop();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** `a as b, c` → [["a","b"],["c","c"]] (import/export clause of minified esbuild output). */
const clause = (s) => s.split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const m = /^([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(x); return m ? [m[1], m[2] ?? m[1]] : null; });

/**
 * Point every import of `fromKey` in `file` at `toKey`, renaming the imported names through `names` (old export → new
 * export). Returns false (and changes nothing) when a reference has a form it cannot rewrite.
 */
function retarget(cwd, file, fromKey, toKey, names) {
  const abs = resolve(cwd, file);
  let text = readFileSync(abs, "utf8");
  const spec = `["'](?:\\.{1,2}/)(?:[^"']*/)?${esc(base(fromKey))}["']`;
  const to = JSON.stringify(rel(abs, resolve(cwd, toKey)));
  let ok = true;
  const map = (list, exp) => list.map((p) => { if (!p || !names.has(p[0])) { ok = false; return ""; } const n = names.get(p[0]); return exp ? `${n} as ${p[1]}` : `${n} as ${p[1]}`; }).join(",");
  text = text.replace(new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*${spec}`, "g"), (_m, c) => `import{${map(clause(c), false)}}from${to}`);
  text = text.replace(new RegExp(`export\\s*\\{([^}]*)\\}\\s*from\\s*${spec}`, "g"), (_m, c) => `export{${map(clause(c), true)}}from${to}`);
  text = text.replace(new RegExp(`import\\s*${spec}`, "g"), () => `import${to}`);
  if (!ok || new RegExp(esc(base(fromKey))).test(text)) return false;
  writeFileSync(abs, text);
  return true;
}

function graph(outs) {
  const js = Object.keys(outs).filter((k) => k.endsWith(".js"));
  const imports = new Map(js.map((k) => [k, (outs[k].imports ?? []).filter((im) => im.kind === "import-statement" && outs[im.path]).map((im) => im.path)]));
  const importers = new Map(js.map((k) => [k, []]));
  for (const [k, list] of imports) for (const d of list) importers.get(d)?.push(k);
  const memo = new Map();
  const closure = (k) => {
    let c = memo.get(k);
    if (c) return c;
    c = new Set([k]);
    const st = [k];
    while (st.length) for (const d of imports.get(st.pop()) ?? []) if (!c.has(d)) { c.add(d); st.push(d); }
    memo.set(k, c);
    return c;
  };
  const entries = js.filter((k) => outs[k].entryPoint);
  const reach = new Map(js.map((k) => [k, new Set()]));
  for (const e of entries) for (const k of closure(e)) reach.get(k)?.add(e);
  return { js, imports, importers, closure, reach };
}

/**
 * @param {import("esbuild").Metafile} meta
 * @param {{ cwd: string, entryKey: string, esbuild: typeof import("esbuild"), minify?: boolean, minSize?: number }} o
 * @returns {Promise<{ stubs: number, folded: number }>}
 */
export async function packChunks(meta, { cwd, entryKey, esbuild, minify = true, minSize = 2048 }) {
  const outs = meta.outputs;
  const text = (k) => readFileSync(resolve(cwd, k), "utf8");
  let stubs = 0, folded = 0;

  // 1. entry stubs: importers take the bindings from the entry itself
  for (const k of Object.keys(outs)) {
    if (!k.endsWith(".js") || outs[k].entryPoint || k === entryKey) continue;
    const m = /^export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?\s*$/.exec(text(k).trim());
    if (!m || posix(resolve(dirname(resolve(cwd, k)), m[2])) !== posix(resolve(cwd, entryKey))) continue;
    const names = new Map(clause(m[1]).filter(Boolean).map(([src, as]) => [as, src]));
    const { importers } = graph(outs);
    const users = importers.get(k) ?? [];
    const before = new Map(users.map((u) => [u, text(u)]));
    if (!users.every((u) => retarget(cwd, u, k, entryKey, names))) { for (const [u, t] of before) writeFileSync(resolve(cwd, u), t); continue; }
    for (const u of users) outs[u].imports = dedupe((outs[u].imports ?? []).map((im) => (im.path === k ? { ...im, path: entryKey } : im)));
    rmSync(resolve(cwd, k), { force: true });
    delete outs[k];
    stubs++;
  }

  // 2. small shared chunks fold into a chunk that is always loaded with them
  const skip = new Set();
  for (let round = 0; round < 500; round++) {
    const g = graph(outs);
    const small = g.js.filter((k) => !outs[k].entryPoint && k !== entryKey && !skip.has(k) && (outs[k].bytes ?? 0) < minSize && !/new URL\(/.test(text(k)))
      .sort((a, b) => (outs[a].bytes ?? 0) - (outs[b].bytes ?? 0));
    let done = false;
    for (const t of small) {
      const rt = g.reach.get(t), deps = [...g.closure(t)].filter((d) => d !== t), users = g.importers.get(t) ?? [];
      let best = null, cost = Infinity;
      for (const b of g.js) {
        if (b === t || b === entryKey) continue;
        const rb = g.reach.get(b), cb = g.closure(b);
        if (cb.has(t) && !users.includes(b)) continue; // B reaches T through another module: that one would cycle
        if (![...rt].every((e) => rb.has(e)) || !deps.every((d) => cb.has(d)) || users.some((u) => u !== b && cb.has(u))) continue;
        const c = (rb.size - rt.size) * 1e6 + (outs[b].bytes ?? 0);
        if (c < cost) { cost = c; best = b; }
      }
      if (!best || !(await fold(t, best, g.importers.get(t) ?? []))) { skip.add(t); continue; }
      folded++; done = true; break;
    }
    if (!done) break;
  }
  return { stubs, folded };

  async function fold(t, b, users) {
    const bAbs = resolve(cwd, b), tAbs = resolve(cwd, t);
    const bExp = outs[b].exports ?? [], tExp = outs[t].exports ?? [];
    const alias = new Map(tExp.map((e, i) => [e, `__pk${(folded * 97 + i).toString(36)}`]));
    const lines = [bExp.length ? `export { ${bExp.map((e) => (e === "default" ? "default" : e)).join(", ")} } from ${JSON.stringify(rel(bAbs, bAbs))};` : `import ${JSON.stringify(rel(bAbs, bAbs))};`,
      tExp.length ? `export { ${[...alias].map(([e, a]) => `${e} as ${a}`).join(", ")} } from ${JSON.stringify(rel(bAbs, tAbs))};` : `import ${JSON.stringify(rel(bAbs, tAbs))};`];
    const inside = new Set([bAbs, tAbs]);
    let res;
    try {
      res = await esbuild.build({
        stdin: { contents: lines.join("\n"), resolveDir: dirname(bAbs), sourcefile: "march-pack.js", loader: "js" },
        bundle: true, format: "esm", write: false, minify, legalComments: "none", target: "es2022", logLevel: "silent", charset: "utf8",
        plugins: [{ name: "march-pack", setup(x) {
          x.onResolve({ filter: /.*/ }, (a) => {
            if (a.kind === "entry-point" || !a.importer) return undefined;
            const abs = resolve(a.resolveDir || dirname(a.importer), a.path);
            return inside.has(abs) ? { path: abs } : { path: rel(bAbs, abs), external: true };
          });
          x.onLoad({ filter: /\.js$/ }, (a) => ({ contents: readFileSync(a.path, "utf8").replace(/new URL\("(\.\/[^"]+\.css)",import\.meta\.url\)/g, (_m, css) => `new URL(${JSON.stringify(rel(bAbs, resolve(dirname(a.path), css)))},import.meta.url)`), loader: "js", resolveDir: dirname(a.path) }));
        } }],
      });
    } catch { return false; }
    // importers of T (other than B) now import the same bindings from B
    const others = users.filter((u) => u !== b);
    const before = new Map(others.map((u) => [u, text(u)]));
    if (!others.every((u) => retarget(cwd, u, t, b, alias))) { for (const [u, x] of before) writeFileSync(resolve(cwd, u), x); return false; }
    writeFileSync(bAbs, res.outputFiles[0].text);
    rmSync(tAbs, { force: true });
    for (const u of others) outs[u].imports = dedupe((outs[u].imports ?? []).map((im) => (im.path === t ? { ...im, path: b } : im)));
    outs[b].imports = dedupe([...(outs[b].imports ?? []), ...(outs[t].imports ?? [])].filter((im) => im.path !== t && im.path !== b));
    outs[b].exports = [...bExp, ...alias.values()];
    outs[b].bytes = Buffer.byteLength(res.outputFiles[0].text);
    delete outs[t];
    return true;
  }
}

function dedupe(list) { const seen = new Set(); return list.filter((im) => { const k = `${im.kind}:${im.path}`; if (seen.has(k)) return false; seen.add(k); return true; }); }
