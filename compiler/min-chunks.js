// Minimum chunk size (march.config.js › chunks.minSize, default 10 KB before gzip). Many tiny files cost more than the
// bytes they save: every one is a request, a cache entry and a worse gzip ratio. After a build:
//   - small shared code is folded by pack-chunks.js (into a chunk always loaded with it, else the cheapest partner);
//   - a small lazy module (a demo sub-page, a lazy() wrapper, a tiny route) is planned here for a second build pass:
//     loaded from a lazy chunk → it becomes a static import of that parent (it joins the parent's chunk);
//     loaded from the entry    → it joins a group chunk with the entry's other small lazy modules (one file);
//   - whatever is still under the limit fails the build, unless chunks.allow names it with a reason.
import { relative, resolve, sep } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";

const posix = (p) => p.split(sep).join("/");

/**
 * The second-pass plan, merged into `prev` (plans accumulate over passes). Returns null when nothing new is planned.
 * @param {import("esbuild").Metafile} meta
 * `boot` (march.config.js › budget.boot): the lazy modules the app loads at start-up (shell pieces). They group only with
 * each other — a page must never ride along at start-up — and their group is exempt from the minimum size.
 * `maxLoad` (march.config.js › budget.route, gzip bytes): two pages never share a group whose download (the group and
 * every chunk it reaches) would be over it — grouping must not push a route past its budget.
 * @param {{ cwd: string, entryKey: string, minSize: number, allow?: Record<string, string>, boot?: string[], prev?: Plan | null, maxLoad?: number }} o
 * @typedef {{ inline: Record<string, { spec: string, mode: "static" | "group", group?: string, name?: string }[]>, groups: Record<string, { abs: string, name: string, key: string }[]>, boot?: string[] }} Plan
 */
export function planSmallLazy(meta, { cwd, entryKey, minSize, allow = {}, boot = [], prev = null, maxLoad }) {
  const outs = meta.outputs;
  const plan = prev ? { inline: structuredClone(prev.inline), groups: structuredClone(prev.groups), boot: [...(prev.boot ?? [])] } : { inline: {}, groups: {}, boot: [] };
  const bootSet = new Set(boot.map(posix));
  const isBoot = (c) => c.keys.some((k) => bootSet.has(k));
  const bootOut = (k) => { const ep = posix(outs[k]?.entryPoint ?? ""); return bootSet.has(ep) || (ep.startsWith("march-group:") && plan.boot.includes(ep.slice(12))); };
  const outOf = (input) => Object.keys(outs).find((k) => k.endsWith(".js") && outs[k].inputs?.[input]);
  let added = 0;
  const pending = [];
  for (const [k, o] of Object.entries(outs)) {
    if (!o.entryPoint || k === entryKey || !k.endsWith(".js") || o.entryPoint.startsWith("march-group:") || (o.bytes ?? 0) >= minSize || allowed(allow, k, o.entryPoint)) continue;
    for (const [inp, info] of Object.entries(meta.inputs)) {
      for (const im of info.imports ?? []) {
        if (im.kind !== "dynamic-import" || im.path !== o.entryPoint) continue;
        const from = outOf(inp);
        if (!from) continue;
        // a start-up piece (the route table, the shell) loads pages the way the entry does: never fold them into it
        if (process.env.MARCH_PLAN_DEBUG) console.log("PEND", inp, "->", o.entryPoint, "from", from, outs[from]?.entryPoint, bootOut(from));
        pending.push({ importer: resolve(cwd, inp), spec: im.original ?? im.path, target: o.entryPoint, toEntry: from === entryKey || bootOut(from) });
      }
    }
  }
  // the entry's small lazy modules join group chunks: clusters of the modules that share the most code, merged pairwise
  // only until each is over the limit (and never past maxGroup), so related pages and shell pieces load together
  const toEntry = pending.filter((p) => p.toEntry);
  const known = new Map(Object.values(plan.groups).flat().map((m) => [m.key, m]));
  const fresh = [...new Map(toEntry.filter((p) => !known.has(posix(p.target))).map((p) => [posix(p.target), p])).values()];
  if (fresh.length) {
    const imports = new Map(Object.entries(outs).map(([k, o]) => [k, (o.imports ?? []).filter((im) => im.kind === "import-statement" && outs[im.path]).map((im) => im.path)]));
    const closure = (k) => { const c = new Set([k]); const st = [k]; while (st.length) for (const d of imports.get(st.pop()) ?? []) if (!c.has(d)) { c.add(d); st.push(d); } c.delete(entryKey); return c; };
    const outByEntry = new Map(Object.entries(outs).filter(([, o]) => o.entryPoint).map(([k, o]) => [posix(o.entryPoint), k]));
    const bytes = (k) => outs[k]?.bytes ?? 0;
    let clusters = fresh.map((p) => { const k = outByEntry.get(posix(p.target)); return { keys: [posix(p.target)], size: bytes(k), reach: closure(k) }; });
    // shared share of the merged reach, and the merged reach in bytes (what loading any member of the group costs)
    const affinity = (x, y) => { let both = 0, any = 0; for (const k of new Set([...x.reach, ...y.reach])) { const w = bytes(k); any += w; if (x.reach.has(k) && y.reach.has(k)) both += w; } return [any ? both / any : 0, any]; };
    const maxGroup = minSize * 4;
    // a merged group comes out smaller than the sum of its members (each chunk's own import / export glue goes), so a
    // group counts as big enough only with a margin; a single module is measured as it is
    const big = (c) => c.size >= (c.keys.length > 1 ? minSize * 1.15 : minSize);
    // gzip size of each output on disk (what the route budget counts); a group costs at most the sum of its parts
    const gzCache = new Map();
    const gz = (k) => { if (!gzCache.has(k)) { const f = resolve(cwd, k); gzCache.set(k, existsSync(f) ? gzipSync(readFileSync(f)).length : 0); } return gzCache.get(k); };
    // what start-up already downloaded (the boot pieces and what they reach) is not part of a route's cost
    const bootReach = new Set(Object.keys(outs).filter((k) => k.endsWith(".js") && bootOut(k)).flatMap((k) => [...closure(k)]));
    const load = (x, y) => { let n = 0; for (const k of new Set([...x.reach, ...y.reach])) if (k.endsWith(".js") && !bootReach.has(k)) n += gz(k); return n; };
    for (;;) {
      let best = null, score = -Infinity;
      for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
        const x = clusters[i], y = clusters[j];
        if ((big(x) && big(y)) || x.size + y.size > maxGroup || isBoot(x) !== isBoot(y)) continue;
        if (maxLoad && !isBoot(x) && load(x, y) > maxLoad) continue;
        // penalise the load cost, not only the group's own size: a dependency-free module (translations) must not
        // join a page that pulls 30 KB of shared code when a lighter partner exists
        const [aff, union] = affinity(x, y);
        const sc = aff - union / (maxGroup * 10);
        if (sc > score) { score = sc; best = [i, j]; }
      }
      if (!best) break;
      const [i, j] = best, x = clusters[i], y = clusters[j];
      clusters = clusters.filter((_, n) => n !== i && n !== j).concat({ keys: [...x.keys, ...y.keys], size: x.size + y.size, reach: new Set([...x.reach, ...y.reach]) });
    }
    let g = Object.keys(plan.groups).length;
    for (const c of clusters) {
      // start-up pieces: one group of their own whatever its size (a lone piece stays as it is)
      if (isBoot(c)) {
        if (c.keys.length < 2) continue;
        const name = `g${g++}`;
        plan.groups[name] = c.keys.map((key, n) => ({ abs: resolve(cwd, key), name: `n${n}`, key, group: name }));
        plan.boot.push(name);
        for (const m of plan.groups[name]) known.set(m.key, m);
        continue;
      }
      // still under the limit with everything it could join (a small app): into the entry; alone: a group gains nothing
      if (!big(c)) { for (const key of c.keys) known.set(key, { key, static: true }); continue; }
      if (c.keys.length < 2) continue;
      const name = `g${g++}`;
      plan.groups[name] = c.keys.map((key, n) => ({ abs: resolve(cwd, key), name: `n${n}`, key, group: name }));
      for (const m of plan.groups[name]) known.set(m.key, m);
    }
  }
  for (const p of toEntry) {
    const m = known.get(posix(p.target));
    if (!m || (plan.inline[p.importer] ?? []).some((x) => x.spec === p.spec)) continue;
    (plan.inline[p.importer] ??= []).push(m.static ? { spec: p.spec, mode: "static" } : { spec: p.spec, mode: "group", group: m.group, name: m.name });
    added++;
  }
  for (const p of pending.filter((x) => !x.toEntry)) {
    if ((plan.inline[p.importer] ?? []).some((x) => x.spec === p.spec)) continue;
    (plan.inline[p.importer] ??= []).push({ spec: p.spec, mode: "static" });
    added++;
  }
  return added ? plan : null;
}

const allowed = (allow, file, entryPoint) => Object.keys(allow).some((a) => file.endsWith(a) || posix(entryPoint ?? "") === a || posix(entryPoint ?? "").endsWith(a));

/**
 * Output files under the limit (JS and CSS in the assets folder), minus chunks.allow.
 * @param {import("esbuild").Metafile} meta
 * @returns {{ file: string, bytes: number }[]}
 */
export function smallFiles(meta, { cwd, minSize, allow = {}, entryKey = null, boot = [], plan = null }) {
  const out = [];
  // the entry and its CSS have nowhere to go (a small app is allowed a small main.js); neither do the start-up pieces
  const skip = new Set([entryKey, entryKey && meta.outputs[entryKey]?.cssBundle].filter(Boolean));
  const bootEntries = new Set([...boot.map(posix), ...(plan?.boot ?? []).map((g) => `march-group:${g}`)]);
  for (const [k, o] of Object.entries(meta.outputs)) if (o.entryPoint && bootEntries.has(posix(o.entryPoint))) { skip.add(k); if (o.cssBundle) skip.add(o.cssBundle); }
  for (const [k, o] of Object.entries(meta.outputs)) {
    if (!/\.(js|css)$/.test(k) || skip.has(k) || !existsSync(resolve(cwd, k))) continue;
    const bytes = readFileSync(resolve(cwd, k)).length;
    if (bytes < minSize && !allowed(allow, k, o.entryPoint)) out.push({ file: posix(relative(cwd, resolve(cwd, k))), bytes });
  }
  return out.sort((a, b) => a.bytes - b.bytes);
}

/** Every group member's manifest key points at its group's files (the router and lazy() preload by that key). */
export function aliasGroups(manifest, plan) {
  for (const [g, members] of Object.entries(plan?.groups ?? {})) {
    const files = manifest[`march-group:${g}`];
    if (files) for (const m of members) manifest[m.key] = files;
  }
  return manifest;
}
