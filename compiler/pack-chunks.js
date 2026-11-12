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
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";

/** Remove the CSS loader of `css` (css-split.js form, plain or minified) from a chunk's code; null when not found. */
function stripCssLoader(code, css) {
  const re = new RegExp(String.raw`await new Promise\(\(?\w+\)?=>\{if\(typeof document[^{}]*?new URL\("\./${esc(css)}(?:\?v=\w+)?",import\.meta\.url\)\.href;[\s\S]*?document\.head\.appendChild\(\w+\)\}\);?\n?`);
  return re.test(code) ? code.replace(re, "") : null;
}
import { dirname, relative, resolve } from "node:path";
import { posix } from "./fs-util.js";

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
 * `budgetOf(outputKey)` (from march.config.js › budget): `{ boot: true }` for a start-up piece, else `{ limit }` in gzip
 * bytes (route or lazy part). A fold that is not free never pushes a route or part past its limit.
 * @param {{ cwd: string, entryKey: string, esbuild: typeof import("esbuild"), minify?: boolean, minSize?: number, budgetOf?: (k: string) => { boot?: boolean, limit?: number } | undefined }} o
 * @returns {Promise<{ stubs: number, folded: number, cssMoved: number }>}
 */
// MARCH_DEBUG_PACK=<part of an input path>: for a small chunk holding that input that found no host, print why each
// candidate host was refused (the last pass is the one that counts)
const DEBUG = process.env.MARCH_DEBUG_PACK;
function explain(g, t, users, fits, bootFits) {
  const ct = g.closure(t), why = new Map();
  for (const b of g.js) {
    if (b === t) continue;
    const cb = g.closure(b);
    const r = cb.has(t) && !users.includes(b) ? "B reaches T"
      : [...ct].some((x) => x !== t && x !== b && g.closure(x).has(b)) ? "T reaches B"
      : users.some((u) => u !== b && cb.has(u)) ? "a user of T is in B's closure"
      : !bootFits(b, t) ? `start-up budget (${bootFits.last})` : !fits(b) ? "route / part budget" : "entry point or not cheaper";
    why.set(r, [...(why.get(r) ?? []), b.split("/").pop()]);
  }
  console.log(`[pack] ${t.split("/").pop()} (${g.reach.get(t).size} entries) stays small:`);
  for (const [r, list] of why) console.log(`  ${r}: ${list.length} — ${list.slice(0, 6).join(", ")}`);
}

export async function packChunks(meta, { cwd, entryKey, esbuild, minify = true, minSize = 2048, budgetOf }) {
  const outs = meta.outputs;
  const gzCache = new Map();
  const gz = (k) => { if (!gzCache.has(k)) { const f = resolve(cwd, k); gzCache.set(k, existsSync(f) ? gzipSync(readFileSync(f)).length : 0); } return gzCache.get(k); };
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
  for (let round = 0; round < 5000; round++) {
    const g = graph(outs);
    // a heavy chunk only one small lazy module imports (code esbuild split out because tree-shaken barrels also reach
    // it) is that module's own code: it joins it, so the lazy module is judged by its real size and is never inlined into
    // its parent (a 3 KB demo entry over 30 KB of editor code). Small ones keep the usual folding below.
    const own = (k) => { const u = g.importers.get(k) ?? []; return (outs[k].bytes ?? 0) >= minSize && u.length === 1 && !!outs[u[0]].entryPoint && u[0] !== entryKey && (outs[u[0]].bytes ?? 0) < minSize ? u[0] : null; };
    const small = g.js.filter((k) => !outs[k].entryPoint && k !== entryKey && !skip.has(k) && ((outs[k].bytes ?? 0) < minSize || own(k)))
      // a lazy module's own code first (once something else joined it, it may no longer count as small); then widely
      // shared code (it competes for the start-up budget with narrow code), then the smallest; the name breaks ties so
      // the same input always folds the same way
      .sort((a, b) => (own(a) ? 0 : 1) - (own(b) ? 0 : 1) || g.reach.get(b).size - g.reach.get(a).size || (outs[a].bytes ?? 0) - (outs[b].bytes ?? 0) || (a < b ? -1 : 1));
    let done = false;
    // start-up pieces (budget.boot) and what they reach: a fold into one of them adds T to start-up for everyone
    const bootEntries = g.js.filter((e) => outs[e].entryPoint && budgetOf?.(e)?.boot);
    const bootReach = new Set(bootEntries.flatMap((e) => [...g.closure(e)]));
    const entryReach = g.closure(entryKey);
    // once T and B are one file, start-up loading either one loads both closures
    const bootAfter = (b, t) => { let n = 0; for (const x of new Set([...bootReach, ...g.closure(t), ...g.closure(b)])) if (!entryReach.has(x)) n += gz(x); return n; };
    const bootFits = (b, t) => {
      const lim = budgetOf?.bootLimit;
      if (lim == null || bootReach.has(b) === bootReach.has(t)) return true;
      if (DEBUG) bootFits.last = `${bootAfter(b, t)} > ${lim}`;
      return bootAfter(b, t) <= lim;
    };
    // what start-up already downloaded (the entry, the boot pieces) is not part of a route's or part's cost
    const have = new Set([...entryReach, ...bootReach]);
    for (const t of small) {
      const rt = g.reach.get(t), deps = [...g.closure(t)].filter((d) => d !== t), users = g.importers.get(t) ?? [];
      let best = own(t), cost = best ? 0 : Infinity;
      // after T and B become one file, everyone loading either loads both closures: none may go past its budget
      const fits = (b) => {
        if (!budgetOf) return true;
        const both = new Set([...g.closure(b), ...g.closure(t)]);
        // into a start-up piece: start-up as a whole (beyond the entry) stays within its own budget
        if (!bootFits(b, t)) return false;
        // only who loads one side and not the other downloads more; who loads both is unchanged (even when over budget)
        const rb = g.reach.get(b);
        for (const e of new Set([...[...rt].filter((x) => !rb.has(x)), ...[...rb].filter((x) => !rt.has(x))])) {
          const lim = budgetOf(e)?.limit;
          if (lim == null) continue;
          let n = 0;
          for (const x of new Set([...g.closure(e), ...both])) if (!have.has(x)) n += gz(x);
          if (n > lim) return false;
        }
        return true;
      };
      for (const b of best ? [] : g.js) {
        if (b === t || b === entryKey) continue;
        const rb = g.reach.get(b), cb = g.closure(b);
        if (cb.has(t) && !users.includes(b)) continue; // B reaches T through another module: that one would cycle
        if (![...rt].every((e) => rb.has(e)) || !deps.every((d) => cb.has(d)) || users.some((u) => u !== b && cb.has(u))) continue;
        // free for T's users only: B's other users (and start-up, when B is a start-up chunk) now download T too
        if (rb.size > rt.size ? !fits(b) : !bootFits(b, t)) continue;
        const c = (rb.size - rt.size) * 1e6 + (outs[b].bytes ?? 0);
        if (c < cost) { cost = c; best = b; }
      }
      // no free host: the chunk (often another small one) that costs the fewest extra bytes: pages that load B now
      // also get T, pages that load T now also get B. Never the entry; never a merge that would close an import cycle.
      if (!best) {
        const bytes = (k) => outs[k].bytes ?? 0;
        for (const b of g.js) {
          if (b === t || b === entryKey || outs[b].entryPoint) continue; // a page or lazy part never becomes a static dependency
          const rb = g.reach.get(b), cb = g.closure(b), ct = g.closure(t);
          if (cb.has(t) && !users.includes(b)) continue; // B → X → T
          if ([...ct].some((x) => x !== t && x !== b && g.closure(x).has(b))) continue; // T → X → B
          if (users.some((u) => u !== b && cb.has(u))) continue;
          // what each side newly downloads is the other's whole static closure, not just its own file: a small chunk with
          // heavy imports must not ride along with a start-up chunk
          const extra = (from, got) => [...from].reduce((s, x) => s + (got.has(x) ? 0 : bytes(x)), 0);
          const c = [...rt].filter((e) => !rb.has(e)).length * extra(cb, ct) + [...rb].filter((e) => !rt.has(e)).length * extra(ct, cb);
          if (c < cost && fits(b)) { cost = c; best = b; }
        }
      }
      if (!best && DEBUG && Object.keys(outs[t].inputs ?? {}).some((i) => i.includes(DEBUG))) explain(g, t, users, fits, bootFits);
      if (!best || !(await fold(t, best, g.importers.get(t) ?? []))) { skip.add(t); continue; }
      folded++; done = true; gzCache.clear(); break;
    }
    if (!done) break;
  }

  // 3. a small CSS file joins the CSS of a chunk that is always loaded with its own (else main.css): its loader goes
  let cssMoved = 0;
  {
    const g = graph(outs);
    const cssOf = (k) => outs[k]?.cssBundle;
    const size = (c) => (existsSync(resolve(cwd, c)) ? readFileSync(resolve(cwd, c)).length : Infinity);
    for (const x of g.js) {
      const c = cssOf(x);
      if (!c || x === entryKey || size(c) >= minSize) continue;
      const rx = g.reach.get(x);
      let host = null, cost = Infinity;
      for (const y of g.js) {
        if (y === x || y === entryKey || !cssOf(y)) continue;
        const ry = g.reach.get(y);
        if (![...rx].every((e) => ry.has(e))) continue;
        const k = ry.size - rx.size;
        if (k < cost) { cost = k; host = y; }
      }
      host ??= cssOf(entryKey) ? entryKey : null;
      if (!host) continue;
      const stripped = stripCssLoader(text(x), base(c));
      if (stripped == null) continue;
      const hc = cssOf(host), css = readFileSync(resolve(cwd, c), "utf8"), hcss = readFileSync(resolve(cwd, hc), "utf8");
      // X before its importer (it loads first); otherwise after the host's own rules
      const first = g.closure(host).has(x);
      writeFileSync(resolve(cwd, hc), first ? `${css}
${hcss}` : `${hcss}
${css}`);
      writeFileSync(resolve(cwd, x), stripped);
      outs[x].bytes = Buffer.byteLength(stripped);
      rmSync(resolve(cwd, c), { force: true });
      outs[hc] = { ...outs[hc], bytes: Buffer.byteLength(readFileSync(resolve(cwd, hc))), inputs: { ...(outs[hc]?.inputs ?? {}), ...(outs[c]?.inputs ?? {}) } };
      delete outs[c];
      delete outs[x].cssBundle;
      cssMoved++;
    }
  }
  // 4. CSS the entry loads at run time joins main.css (after its rules: the same order, and no wait in main.js)
  let code = outs[entryKey] ? text(entryKey) : "";
  // an entry without CSS of its own: the first CSS it loads becomes its stylesheet (a link in index.html)
  if (outs[entryKey] && !outs[entryKey].cssBundle) {
    const m = /new URL\("\.\/([^"?]+\.css)(?:\?v=\w+)?",import\.meta\.url\)/.exec(code);
    const file = m && posix(relative(cwd, resolve(dirname(resolve(cwd, entryKey)), m[1])));
    const stripped = m && stripCssLoader(code, m[1]);
    if (file && stripped != null && outs[file]) { code = stripped; outs[entryKey].cssBundle = file; writeFileSync(resolve(cwd, entryKey), code); outs[entryKey].bytes = Buffer.byteLength(code); cssMoved++; }
  }
  const mainCss = outs[entryKey]?.cssBundle;
  if (mainCss && existsSync(resolve(cwd, mainCss))) {
    for (const m of [...code.matchAll(/new URL\("\.\/([^"?]+\.css)(?:\?v=\w+)?",import\.meta\.url\)/g)]) {
      const file = posix(relative(cwd, resolve(dirname(resolve(cwd, entryKey)), m[1])));
      const key = Object.keys(outs).find((k) => posix(k) === file);
      const stripped = stripCssLoader(code, m[1]);
      if (!key || stripped == null || !existsSync(resolve(cwd, key))) continue;
      const css = readFileSync(resolve(cwd, key), "utf8");
      fs_append(resolve(cwd, mainCss), css);
      code = stripped;
      rmSync(resolve(cwd, key), { force: true });
      outs[mainCss] = { ...outs[mainCss], bytes: readFileSync(resolve(cwd, mainCss)).length, inputs: { ...(outs[mainCss]?.inputs ?? {}), ...(outs[key]?.inputs ?? {}) } };
      delete outs[key];
      cssMoved++;
    }
    writeFileSync(resolve(cwd, entryKey), code);
    outs[entryKey].bytes = Buffer.byteLength(code);
  }
  return { stubs, folded, cssMoved };

  /**
   * T's CSS moves in front of B's (T loads first): one file, one loader. Returns an undo (the fold may still fail), or
   * null when there is nothing to merge or a loader cannot be found.
   */
  function mergeCss(t, b) {
    const tc = outs[t].cssBundle, bc = outs[b].cssBundle;
    if (!tc || !bc) return null;
    const tText = text(t), stripped = stripCssLoader(tText, base(tc));
    if (stripped == null || !existsSync(resolve(cwd, tc)) || !existsSync(resolve(cwd, bc))) return null;
    const tCss = readFileSync(resolve(cwd, tc), "utf8"), bCss = readFileSync(resolve(cwd, bc), "utf8");
    const saved = { tc: outs[tc], bc: outs[bc] };
    writeFileSync(resolve(cwd, bc), `${tCss}
${bCss}`);
    writeFileSync(resolve(cwd, t), stripped);
    rmSync(resolve(cwd, tc), { force: true });
    outs[bc] = { ...outs[bc], bytes: Buffer.byteLength(`${tCss}
${bCss}`), inputs: { ...(outs[bc]?.inputs ?? {}), ...(outs[tc]?.inputs ?? {}) } };
    delete outs[tc];
    delete outs[t].cssBundle;
    return () => {
      writeFileSync(resolve(cwd, bc), bCss); writeFileSync(resolve(cwd, tc), tCss); writeFileSync(resolve(cwd, t), tText);
      outs[bc] = saved.bc; outs[tc] = saved.tc; outs[t].cssBundle = tc;
    };
  }

  async function fold(t, b, users) {
    const bAbs = resolve(cwd, b), tAbs = resolve(cwd, t);
    const undoCss = mergeCss(t, b);
    const fail = () => { undoCss?.(); return false; };
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
    } catch { return fail(); }
    // importers of T (other than B) now import the same bindings from B
    const others = users.filter((u) => u !== b);
    const before = new Map(others.map((u) => [u, text(u)]));
    if (!others.every((u) => retarget(cwd, u, t, b, alias))) { for (const [u, x] of before) writeFileSync(resolve(cwd, u), x); return fail(); }
    writeFileSync(bAbs, res.outputFiles[0].text);
    rmSync(tAbs, { force: true });
    for (const u of others) outs[u].imports = dedupe((outs[u].imports ?? []).map((im) => (im.path === t ? { ...im, path: b } : im)));
    outs[b].imports = dedupe([...(outs[b].imports ?? []), ...(outs[t].imports ?? [])].filter((im) => im.path !== t && im.path !== b));
    outs[b].exports = [...bExp, ...alias.values()];
    outs[b].bytes = Buffer.byteLength(res.outputFiles[0].text);
    outs[b].inputs = { ...(outs[b].inputs ?? {}), ...(outs[t].inputs ?? {}) }; // size reports still see what was folded in
    if (outs[t].cssBundle && !outs[b].cssBundle) outs[b].cssBundle = outs[t].cssBundle; // B now runs T's CSS loader
    delete outs[t];
    return true;
  }
}

function fs_append(file, css) { writeFileSync(file, `${readFileSync(file, "utf8")}
${css}`); }
function dedupe(list) { const seen = new Set(); return list.filter((im) => { const k = `${im.kind}:${im.path}`; if (seen.has(k)) return false; seen.add(k); return true; }); }
