// Minimum chunk size (march.config.js › chunks.minSize, default 10 KB before gzip). Many tiny files cost more than the
// bytes they save: every one is a request, a cache entry and a worse gzip ratio. After a build:
//   - small shared code is folded by pack-chunks.js (into a chunk always loaded with it, else the cheapest partner);
//   - a small lazy module (a demo sub-page, a lazy() wrapper, a tiny route) is planned here for a second build pass:
//     loaded from a lazy chunk → it becomes a static import of that parent (it joins the parent's chunk);
//     loaded from the entry    → it joins a group chunk with the entry's other small lazy modules (one file);
//   - whatever is still under the limit fails the build, unless chunks.allow names it with a reason.
import { relative, resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { posix } from "./fs-util.js";

/** Route tables found by default: `march gen routes` output and a hand-written src/routes.* file. */
export const ROUTE_TABLES = ["src/routes.gen.js", "src/routes.gen.ts", "src/routes.ts", "src/routes.tsx", "src/routes.js", "src/routes.jsx"];

/**
 * The second-pass plan, merged into `prev` (plans accumulate over passes). Returns null when nothing new is planned.
 * @param {import("esbuild").Metafile} meta
 * `boot` (march.config.js › budget.boot): the lazy modules the app loads at start-up (shell pieces). They group only with
 * each other — a page must never ride along at start-up — and their group is exempt from the minimum size.
 * `maxLoad` (march.config.js › budget.route, gzip bytes): two pages never share a group whose download (the group and
 * every chunk it reaches) would be over it — grouping must not push a route past its budget.
 * `tables` (march.config.js › chunks.routeTables): source files whose lazy imports are pages (the route table). Like the
 * entry's, those pages join page groups; they are never folded into the table (a start-up chunk would grow per page).
 * @param {{ cwd: string, entryKey: string, minSize: number, allow?: Record<string, string>, boot?: string[], prev?: Plan | null, maxLoad?: number, room?: number, tables?: string[] }} o
 * @typedef {{ inline: Record<string, { spec: string, mode: "static" | "group", group?: string, name?: string }[]>, groups: Record<string, { abs: string, name: string, key: string }[]>, boot?: string[], keep?: string[] }} Plan
 */
export function planSmallLazy(meta, { cwd, entryKey, minSize, allow = {}, boot = [], prev = null, maxLoad, room = 0, tables = ROUTE_TABLES }) {
  const outs = meta.outputs;
  const plan = prev ? { inline: structuredClone(prev.inline), groups: structuredClone(prev.groups), boot: [...(prev.boot ?? [])], keep: [...(prev.keep ?? [])] } : { inline: {}, groups: {}, boot: [], keep: [] };
  const bootSet = new Set(boot.map(posix));
  const isBoot = (c) => c.keys.some((k) => bootSet.has(k));
  const bootOut = (k) => { const ep = posix(outs[k]?.entryPoint ?? ""); return bootSet.has(ep) || (ep.startsWith("march-group:") && plan.boot.includes(ep.slice(12))); };
  const routeTables = new Set(tables.map(posix));
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
        // a route table (its lazy imports are pages) loads them the way the entry does: pages group, never fold into it
        const table = routeTables.has(posix(inp));
        pending.push({ importer: resolve(cwd, inp), spec: im.original ?? im.path, target: o.entryPoint, toEntry: from === entryKey || table, table, key: k, from });
      }
    }
  }
  const imports = new Map(Object.entries(outs).map(([k, o]) => [k, (o.imports ?? []).filter((im) => im.kind === "import-statement" && outs[im.path]).map((im) => im.path)]));
  const closure = (k) => { const c = new Set([k]); const st = [k]; while (st.length) for (const d of imports.get(st.pop()) ?? []) if (!c.has(d)) { c.add(d); st.push(d); } c.delete(entryKey); return c; };
  const outByEntry = new Map(Object.entries(outs).filter(([, o]) => o.entryPoint).map(([k, o]) => [posix(o.entryPoint), k]));
  const bytes = (k) => outs[k]?.bytes ?? 0;
  // gzip size of each output on disk (what the route budget counts)
  const gzCache = new Map();
  const gz = (k) => { if (!gzCache.has(k)) { const f = resolve(cwd, k); gzCache.set(k, existsSync(f) ? gzipSync(readFileSync(f)).length : 0); } return gzCache.get(k); };
  // what start-up already downloaded (the boot pieces and what they reach) is not part of a route's cost
  const bootReach = new Set(Object.keys(outs).filter((k) => k.endsWith(".js") && bootOut(k)).flatMap((k) => [...closure(k)]));
  const cost = (reach) => { let n = 0; for (const k of reach) if (k.endsWith(".js") && !bootReach.has(k)) n += gz(k); return n; };
  const load = (x, y) => cost(new Set([...x.reach, ...y.reach]));
  // estimates come from the previous layout; a group built from them may still cost more once built: such a group is
  // taken apart (its members are planned again next pass) and its members' estimates are scaled by what it really cost
  plan.tight = { ...(prev?.tight ?? {}) };
  // the other way round: a group may come out smaller than its members' sum (their shared code goes to a shared chunk)
  // and land under the floor; it is taken apart too, and its members' sizes are scaled by what it really weighed
  plan.est = { ...(prev?.est ?? {}) };
  plan.shrink = { ...(prev?.shrink ?? {}) };
  for (const [name, ms] of Object.entries(plan.groups)) {
    const k = outByEntry.get(`march-group:${name}`);
    // measured on disk: the metafile size is before the build's own rewrites
    const real = existsSync(resolve(cwd, k)) ? readFileSync(resolve(cwd, k)).length : bytes(k);
    if (plan.boot.includes(name) || !k || !plan.est[name] || real >= minSize) continue;
    delete plan.groups[name];
    for (const [imp, list] of Object.entries(plan.inline)) plan.inline[imp] = list.filter((x) => x.group !== name);
    for (const m of ms) plan.shrink[m.key] = Math.min(plan.shrink[m.key] ?? 1, (real / plan.est[name]) * 0.95);
    added++;
  }
  const tightOf = (x, y) => Math.max(1, ...[...x.keys, ...y.keys].map((k) => plan.tight[k] ?? 1));
  // room (chunks.commonRoom): new groups stay that far under maxLoad (space for the shared "common" chunk); a page that
  // would otherwise stay alone and small may still use the whole budget
  const fits = (x, y, r = room) => !maxLoad || load(x, y) * tightOf(x, y) <= maxLoad - r;
  if (maxLoad) for (const [name, ms] of Object.entries(plan.groups)) {
    const k = outByEntry.get(`march-group:${name}`);
    if (plan.boot.includes(name) || !k) continue;
    const real = cost(closure(k));
    if (real <= maxLoad) continue;
    delete plan.groups[name];
    for (const [imp, list] of Object.entries(plan.inline)) plan.inline[imp] = list.filter((x) => x.group !== name);
    for (const m of ms) plan.tight[m.key] = Math.max(plan.tight[m.key] ?? 1, (real / maxLoad) * 1.05);
    added++;
  }
  // the entry's small lazy modules join group chunks: clusters of the modules that share the most code, merged pairwise
  // only until each is over the limit (and never past maxGroup), so related pages and shell pieces load together
  const toEntry = pending.filter((p) => p.toEntry);
  const known = new Map(Object.values(plan.groups).flat().map((m) => [m.key, m]));
  const fresh = [...new Map(toEntry.filter((p) => !known.has(posix(p.target))).map((p) => [posix(p.target), p])).values()];
  let g = Math.max(-1, ...Object.keys(plan.groups).map((n) => Number(n.slice(1)) || 0)) + 1;
  if (fresh.length) {
    let clusters = fresh.map((p) => { const k = outByEntry.get(posix(p.target)); return { keys: [posix(p.target)], size: bytes(k) * (plan.shrink[posix(p.target)] ?? 1), reach: closure(k) }; });
    // shared share of the merged reach, and the merged reach in bytes (what loading any member of the group costs)
    const affinity = (x, y) => { let both = 0, any = 0; for (const k of new Set([...x.reach, ...y.reach])) { const w = bytes(k); any += w; if (x.reach.has(k) && y.reach.has(k)) both += w; } return [any ? both / any : 0, any]; };
    const maxGroup = minSize * 4;
    for (;;) {
      let best = null, score = -Infinity;
      for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
        const x = clusters[i], y = clusters[j];
        if ((x.size >= minSize && y.size >= minSize) || x.size + y.size > maxGroup || isBoot(x) !== isBoot(y)) continue;
        // a group never pushes a route past its budget (start-up pieces have their own row)
        if (!isBoot(x) && !fits(x, y)) continue;
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
    // a page of a route table still alone and small joins, within the route budget, the cluster or the existing group it
    // costs least to load with; with none it stays a file of its own (reported under chunks.minSize), never in the table
    const tableKeys = new Set(fresh.filter((p) => p.table).map((p) => posix(p.target)));
    const built = Object.entries(plan.groups).filter(([name]) => !plan.boot.includes(name) && outByEntry.has(`march-group:${name}`))
      .map(([name, ms]) => { const k = outByEntry.get(`march-group:${name}`); return { name, keys: ms.map((m) => m.key), size: bytes(k), reach: closure(k) }; });
    for (let i = 0; i < clusters.length; i++) {
      const x = clusters[i];
      if (x.size >= minSize || isBoot(x) || !x.keys.some((k) => tableKeys.has(k))) continue;
      const all = [...clusters.filter((y, j) => j !== i && !isBoot(y)), ...built];
      const y = (all.filter((c) => fits(x, c)).length ? all.filter((c) => fits(x, c)) : all.filter((c) => fits(x, c, 0))).sort((a, b) => load(x, a) - load(x, b))[0];
      // nothing to join at all (a small app): the usual rule below; partners only over budget: a file of its own
      if (!y) { x.lone = all.length > 0; continue; }
      clusters.splice(i, 1);
      i = -1;
      if (y.name) {
        // into a group that is already built: it gains a member
        for (const key of x.keys) { const m = { abs: resolve(cwd, key), name: `n${plan.groups[y.name].length}`, key, group: y.name }; plan.groups[y.name].push(m); known.set(key, m); }
        y.keys.push(...x.keys); y.size += x.size; for (const r of x.reach) y.reach.add(r);
        if (plan.est[y.name]) plan.est[y.name] += x.size;
      } else {
        const j = clusters.indexOf(y);
        clusters[j] = { keys: [...y.keys, ...x.keys], size: x.size + y.size, reach: new Set([...x.reach, ...y.reach]) };
      }
    }
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
      if (c.lone) continue;
      if (c.size < minSize) { for (const key of c.keys) known.set(key, { key, static: true }); continue; }
      if (c.keys.length < 2) continue;
      const name = `g${g++}`;
      plan.est[name] = c.size;
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
  // inlining a small lazy module makes everyone who loads its parent download its static closure too: when that brings
  // more than minSize of code the parent does not already load (a tiny demo in front of a 30 KB editor), and the parent
  // is shared by several pages, it stays lazy —
  // a small file that gates a big download (smallFiles lets it through)
  const deps = new Map(Object.entries(outs).map(([k, o]) => [k, (o.imports ?? []).filter((im) => im.kind === "import-statement" && outs[im.path]).map((im) => im.path)]));
  const reach = (k) => { const c = new Set([k]); const st = [k]; while (st.length) for (const d of deps.get(st.pop()) ?? []) if (!c.has(d)) { c.add(d); st.push(d); } return c; };
  const extra = (p) => { const have = reach(p.from); let n = 0; for (const k of reach(p.key)) if (k !== p.key && !have.has(k)) n += outs[k]?.bytes ?? 0; return n; };
  // a parent that several pages or lazy parts load (shared code): inlining there costs every one of them
  const entries = Object.keys(outs).filter((k) => outs[k].entryPoint && k.endsWith(".js"));
  const shared = (from) => entries.filter((e) => e !== from && reach(e).has(from)).length >= 2;
  plan.keep ??= [];
  for (const p of pending.filter((x) => !x.toEntry)) {
    if ((plan.inline[p.importer] ?? []).some((x) => x.spec === p.spec)) continue;
    if (plan.keep.includes(posix(p.target))) continue;
    if (shared(p.from) && extra(p) >= minSize) { plan.keep.push(posix(p.target)); added++; continue; }
    (plan.inline[p.importer] ??= []).push({ spec: p.spec, mode: "static" });
    added++;
  }
  return added ? plan : null;
}

// an allow key names an output file, an entry point, or a module: a shared chunk holding that module is allowed too
const allowed = (allow, file, entryPoint, inputs = []) => Object.keys(allow).some((a) => file.endsWith(a) || posix(entryPoint ?? "") === a || posix(entryPoint ?? "").endsWith(a) || inputs.some((i) => posix(i).endsWith(a)));

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
  // lazy modules kept small on purpose: they gate a big download their parent must not carry (planSmallLazy)
  const keep = new Set(plan?.keep ?? []);
  for (const [k, o] of Object.entries(meta.outputs)) if (o.entryPoint && keep.has(posix(o.entryPoint))) { skip.add(k); if (o.cssBundle) skip.add(o.cssBundle); }
  for (const [k, o] of Object.entries(meta.outputs)) {
    if (!/\.(js|css)$/.test(k) || skip.has(k) || !existsSync(resolve(cwd, k))) continue;
    const bytes = readFileSync(resolve(cwd, k)).length;
    if (bytes < minSize && !allowed(allow, k, o.entryPoint, Object.keys(o.inputs ?? {}))) out.push({ file: posix(relative(cwd, resolve(cwd, k))), bytes });
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
