// march-app-ui layout core: the panel tree of an IDE-like workspace, with no DOM (tested in Node: test/app-ui-layout.test.js).
// Ported from HADİ Studio Kit (dock_core.js).
//
// A layout is a tree: { v, seq, max, root }. Nodes are
//   { t: "row", id, kids, sizes }   children side by side      { t: "col", id, kids, sizes }   children stacked
//   { t: "tabs", id, panels, active, collapsed }               a tab group (one panel is a group too)
// `sizes` are weights (sum 1); pixels come from computeRects. A collapsed child keeps its weight and gets it back on open.
//
// Closing never deletes, it narrows. The direction comes from the parent split:
//   parent "col" → the group is one of the stacked bands and narrows vertically: a horizontal strip, title horizontal;
//   parent "row" → the group is one of the columns and narrows horizontally: a vertical strip, title turned -90°.
// A split whose children are all collapsed counts as collapsed: it becomes ONE strip in the split above (whose direction
// decides), so the neighbour takes the room; the strip lists every panel below. At least one group stays open.

import { clamp } from "../core/util.ts";

/** Version of the saved layout format (a saved layout of another version is ignored). */
export const LAYOUT_V = 1;
/** The whole workspace as a drop target (docking to the outer edge). */
export const ROOT = "@root";
/** Pixel metrics: gap between areas, collapsed strip, group header, outer-edge hit band, outer inset. */
export const METRICS: Readonly<Metrics> = Object.freeze({ gap: 6, strip: 28, header: 33, edge: 6, inset: 8 });
export interface Metrics { gap: number; strip: number; header: number; edge: number; inset: number }

export type Side = "left" | "right" | "top" | "bottom";
export type Zone = Side | "center";
export interface TabsNode { t: "tabs"; id: string; panels: string[]; active: string | null; collapsed: boolean; /** Size in px before collapsing. */ px?: number }
export interface SplitNode { t: "row" | "col"; id: string; kids: LayoutNode[]; sizes: number[] }
export type LayoutNode = TabsNode | SplitNode;
export interface Layout { v: number; seq: number; max: string | null; root: LayoutNode }
export interface Rect { x: number; y: number; w: number; h: number }

/** Where a panel the saved layout does not know goes: next to `near` on `zone`, `size` of the room, maybe collapsed. */
export interface PanelPlace { near?: string; zone?: Zone; size?: number; collapsed?: boolean }
/** What the layout knows of a panel: its id, minimum size [w, h] in px and default place. */
export interface PanelDef { id: string; min?: readonly [number, number]; place?: PanelPlace }

/** A tree written without ids (presets): tabs(…), row(…), col(…). */
export type TreeSpec = { t: "tabs"; panels: string[]; active?: string | null; collapsed?: boolean } | { t: "row" | "col"; kids: TreeSpec[]; sizes: number[] };
/** A tab group in a preset tree. */
export const tabs = (panels: string | string[], o: { active?: string; collapsed?: boolean } = {}): TreeSpec => {
  const list = ([] as string[]).concat(panels);
  return { t: "tabs", panels: list, active: o.active ?? list[0] ?? null, collapsed: !!o.collapsed };
};
const split = (t: "row" | "col") => (...items: [number, TreeSpec][]): TreeSpec => ({ t, kids: items.map((i) => i[1]), sizes: items.map((i) => i[0]) });
/** Children side by side: row([weight, child], …). */
export const row = split("row");
/** Children stacked: col([weight, child], …). */
export const col = split("col");
/** A named ready-made layout. */
export interface Preset { title: string; tree: () => TreeSpec }

const isGroup = (n: LayoutNode): n is TabsNode => n.t === "tabs";
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
function walk(n: LayoutNode, f: (n: LayoutNode, parent: SplitNode | null, i: number) => void, parent: SplitNode | null = null, i = 0): void {
  f(n, parent, i);
  if (!isGroup(n)) n.kids.forEach((k, j) => walk(k, f, n, j));
}
interface At { node: LayoutNode; parent: SplitNode | null; index: number }
function locate(root: LayoutNode, id: string): At | null {
  let hit: At | null = null;
  walk(root, (node, parent, index) => { if (node.id === id) hit = { node, parent, index }; });
  return hit;
}
/** Every tab group, in tree order. */
export function groups(root: LayoutNode): TabsNode[] { const out: TabsNode[] = []; walk(root, (n) => { if (isGroup(n)) out.push(n); }); return out; }
/** Every panel id in the tree. */
export const allPanels = (root: LayoutNode): string[] => groups(root).flatMap((x) => x.panels);
/** The group holding a panel. */
export const groupOf = (L: Layout, panel: string): TabsNode | null => groups(L.root).find((x) => x.panels.includes(panel)) ?? null;
/** A node by id. */
export const findNode = (L: Layout, id: string): LayoutNode | null => locate(L.root, id)?.node ?? null;
const fresh = (L: Layout, kind: string): string => `${kind}${L.seq++}`;
/** Collapsed: a group by its flag, a split when every child is. */
export const isCollapsed = (n: LayoutNode): boolean => (isGroup(n) ? n.collapsed : n.kids.every(isCollapsed));

function assignIds(L: Layout, n: TreeSpec | LayoutNode): void {
  (n as LayoutNode).id = fresh(L, n.t === "tabs" ? "g" : "s");
  if (n.t !== "tabs") (n.kids as (TreeSpec | LayoutNode)[]).forEach((k) => assignIds(L, k));
}
/** A layout from a tree written without ids. */
export function fromTree(tree: TreeSpec): Layout {
  const L: Layout = { v: LAYOUT_V, seq: 1, max: null, root: clone(tree) as LayoutNode };
  assignIds(L, L.root);
  for (const g of groups(L.root)) { g.active ??= g.panels[0] ?? null; g.collapsed = !!g.collapsed; }
  return normalize(L);
}

function tidy(n: LayoutNode): LayoutNode | null {
  if (isGroup(n)) return n.panels.length ? n : null;
  const kids: LayoutNode[] = [], sizes: number[] = [];
  n.kids.forEach((k, i) => {
    const c = tidy(k), w = (n.sizes[i] ?? 0) > 0 ? (n.sizes[i] as number) : 0.001;
    if (!c) return;
    if (!isGroup(c) && c.t === n.t) {
      const sum = c.sizes.reduce((a, b) => a + b, 0) || 1;
      c.kids.forEach((kk, j) => { kids.push(kk); sizes.push((w * (c.sizes[j] as number)) / sum); });
    } else { kids.push(c); sizes.push(w); }
  });
  if (!kids.length) return null;
  if (kids.length === 1) return kids[0] as LayoutNode;
  const sum = sizes.reduce((a, b) => a + b, 0);
  n.kids = kids; n.sizes = sizes.map((x) => x / sum);
  return n;
}
/** Drops empty groups and one-child splits, flattens nested splits of the same direction, weights sum to 1. */
export function normalize(L: Layout): Layout {
  L.root = tidy(L.root) ?? { t: "tabs", id: fresh(L, "g"), panels: [], active: null, collapsed: false };
  for (const x of groups(L.root)) { if (!x.active || !x.panels.includes(x.active)) x.active = x.panels[0] ?? null; }
  if (isCollapsed(L.root)) (groups(L.root)[0] as TabsNode).collapsed = false;
  if (L.max) { const n = findNode(L, L.max); if (!n || !isGroup(n) || n.collapsed) L.max = null; }
  return L;
}

function detach(L: Layout, panel: string): TabsNode | null {
  const x = groupOf(L, panel);
  if (!x) return null;
  const i = x.panels.indexOf(panel);
  x.panels.splice(i, 1);
  if (x.active === panel) x.active = x.panels[Math.min(i, x.panels.length - 1)] ?? null;
  return x;
}
/** A new node next to `node`: a sibling in a split of that direction, else both wrapped in a new split. frac: the new one's share. */
function dockBeside(L: Layout, node: LayoutNode, added: LayoutNode, zone: Zone, frac = 0.5): void {
  const axis = zone === "left" || zone === "right" ? "row" : "col", before = zone === "left" || zone === "top";
  const at = locate(L.root, node.id) as At;
  if (at.parent?.t === axis) {
    const w = at.parent.sizes[at.index] as number;
    at.parent.sizes[at.index] = w * (1 - frac);
    at.parent.kids.splice(at.index + (before ? 0 : 1), 0, added);
    at.parent.sizes.splice(at.index + (before ? 0 : 1), 0, w * frac);
    return;
  }
  const wrap: SplitNode = { t: axis, id: fresh(L, "s"), kids: before ? [added, node] : [node, added], sizes: before ? [frac, 1 - frac] : [1 - frac, frac] };
  if (at.parent) at.parent.kids[at.index] = wrap; else L.root = wrap;
}
const newGroup = (L: Layout, panels: string[], collapsed = false): TabsNode => ({ t: "tabs", id: fresh(L, "g"), panels: [...panels], active: panels[0] ?? null, collapsed });

/** Moves a panel. target: a group id or ROOT; zone: a side or center; index: tab position (center). */
export function movePanel(layout: Layout, panel: string, target: string, zone: Zone, index?: number): Layout {
  const L = clone(layout), src = groupOf(L, panel);
  if (!src) return layout;
  if (target === ROOT) {
    if (isGroup(L.root) && L.root.panels.length === 1) return layout;
    detach(L, panel);
    L.max = null;
    const added = newGroup(L, [panel]);
    normalize(L);
    dockBeside(L, L.root, added, zone === "center" ? "right" : zone, 0.26);
    return normalize(L);
  }
  const tgt = findNode(L, target);
  if (!tgt || !isGroup(tgt)) return layout;
  if (zone === "center" || tgt.collapsed) {
    if (tgt === src && zone === "center" && index === undefined) return layout;
    const wasActive = src.active;
    detach(L, panel);
    const at = clamp(index ?? tgt.panels.length, 0, tgt.panels.length);
    tgt.panels.splice(at, 0, panel);
    tgt.active = tgt === src ? wasActive : panel;
    if (L.max && L.max !== tgt.id) L.max = null;
    return normalize(L);
  }
  if (tgt === src && src.panels.length === 1) return layout;
  detach(L, panel);
  L.max = null;
  dockBeside(L, tgt, newGroup(L, [panel]), zone);
  return normalize(L);
}
/** Tab order: the panel moves to `index` in its group. */
export function moveTab(layout: Layout, panel: string, index: number): Layout {
  const x = groupOf(layout, panel);
  return x ? movePanel(layout, panel, x.id, "center", index) : layout;
}
/** Brings a panel's tab to the front of its group. */
export function setActive(layout: Layout, panel: string): Layout {
  const L = clone(layout), x = groupOf(L, panel);
  if (x) x.active = panel;
  return L;
}
/** False for the last open group. */
export function canCollapse(layout: Layout, groupId: string): boolean {
  return groups(layout.root).some((x) => x.id !== groupId && !x.collapsed);
}
/** Geometry for size-keeping operations: the area and computeRects options. */
export interface Geo { area: Rect; opts?: RectOptions }
/** Collapses a group to a strip; with `geo` its pixel size is kept and given back on restore. */
export function collapseGroup(layout: Layout, groupId: string, geo?: Geo): Layout {
  if (!canCollapse(layout, groupId)) return layout;
  const L = clone(layout), n = findNode(L, groupId);
  if (!n || !isGroup(n)) return layout;
  if (geo) {
    const at = locate(L.root, groupId) as At, r = computeRects(layout, geo.area, geo.opts).groups[groupId];
    if (r && at.parent) n.px = at.parent.t === "row" ? r.w : r.h;
  }
  n.collapsed = true;
  if (L.max === groupId) L.max = null;
  return normalize(L);
}
/** Opens a strip: the group gets its share (or its pixel size) back; `panel` comes to the front. */
export function restoreGroup(layout: Layout, groupId: string, panel?: string, geo?: Geo): Layout {
  const L = clone(layout), n = findNode(L, groupId);
  if (!n || !isGroup(n)) return layout;
  const px = n.px;
  delete n.px;
  n.collapsed = false;
  if (panel && n.panels.includes(panel)) n.active = panel;
  normalize(L);
  return px && geo ? fitTo(L, groupId, px, geo) : L;
}
/** Brings a group to `px` in its split; the next open sibling (else the previous) pays, minimums kept. */
function fitTo(L: Layout, id: string, px: number, geo: Geo): Layout {
  const at = locate(L.root, id);
  if (!at?.parent) return L;
  const R = computeRects(L, geo.area, geo.opts), info = R.splits[at.parent.id], cur = info?.px[at.index];
  const others = Object.keys(info?.px ?? {}).map(Number).filter((i) => i !== at.index);
  if (cur === undefined || !others.length) return L;
  return resizeSplit(L, at.parent.id, at.index, others.find((i) => i > at.index) ?? (others[others.length - 1] as number), px - cur, R);
}
/** Makes a panel visible: opens its strip, brings its tab to the front, ends another group's maximize. */
export function reveal(layout: Layout, panel: string, geo?: Geo): Layout {
  const x0 = groupOf(layout, panel);
  if (!x0) return layout;
  const L = x0.collapsed ? restoreGroup(layout, x0.id, panel, geo) : clone(layout), x = groupOf(L, panel) as TabsNode;
  x.active = panel;
  if (L.max && L.max !== x.id) L.max = null;
  return normalize(L);
}
/** Focus mode: the panel's group stays open, every other group goes to a strip (the caller keeps the old layout). */
export function focusOnly(layout: Layout, panel: string, geo?: Geo): Layout {
  let L = setActive(layout, panel);
  const own = groupOf(L, panel);
  if (!own) return layout;
  if (L.max) L = { ...L, max: null };
  if (own.collapsed) L = restoreGroup(L, own.id, panel, geo);
  for (const g of groups(L.root)) if (g.id !== own.id && !g.collapsed && canCollapse(L, g.id)) L = collapseGroup(L, g.id, geo);
  return L;
}
/** Opens every collapsed group. */
export function expandAll(layout: Layout): Layout {
  const L = clone(layout);
  for (const x of groups(L.root)) x.collapsed = false;
  return L;
}
/** Toggles a group filling the whole area. */
export function maximize(layout: Layout, groupId: string): Layout {
  const L = clone(layout), n = findNode(L, groupId);
  if (!n || !isGroup(n)) return layout;
  n.collapsed = false;
  L.max = L.max === groupId ? null : groupId;
  return normalize(L);
}
/** The strip direction a group WOULD get if collapsed: "horizontal" (title level) or "vertical" (title at -90°). */
export function collapseMode(root: LayoutNode, groupId: string): "horizontal" | "vertical" {
  const trail: LayoutNode[] = [];
  const visit = (n: LayoutNode, path: LayoutNode[]): void => { if (n.id === groupId) trail.push(...path, n); else if (!isGroup(n)) n.kids.forEach((k) => visit(k, [...path, n])); };
  visit(root, []);
  if (!trail.length) return "horizontal";
  let closed = trail[trail.length - 1] as LayoutNode;
  for (let i = trail.length - 2; i >= 0; i--) {
    const p = trail[i] as SplitNode;
    if (!p.kids.every((k) => k === closed || isCollapsed(k))) return p.t === "row" ? "vertical" : "horizontal";
    closed = p;
  }
  return "horizontal";
}

// ------------------------------------------------------------------ geometry
/** Splits `avail` px by weights keeping minimums; when they do not fit, the minimums shrink in proportion. Integers. */
export function allot(avail: number, weights: number[], mins: number[]): number[] {
  const n = weights.length, out = new Array<number>(n).fill(0);
  if (!n) return out;
  const room = Math.max(0, avail), sumMin = mins.reduce((a, b) => a + b, 0);
  const wt = (i: number): number => Math.max(weights[i] as number, 0.001);
  if (sumMin >= room) { for (let i = 0; i < n; i++) out[i] = sumMin ? ((mins[i] as number) * room) / sumMin : room / n; }
  else {
    const free = new Set(weights.map((_, i) => i));
    let rem = room;
    for (;;) {
      const sum = [...free].reduce((a, i) => a + wt(i), 0);
      const low = [...free].filter((i) => (rem * wt(i)) / sum < (mins[i] as number));
      if (!low.length) { for (const i of free) out[i] = (rem * wt(i)) / sum; break; }
      for (const i of low) { out[i] = mins[i] as number; rem -= mins[i] as number; free.delete(i); }
      if (!free.size) break;
    }
  }
  const ints = out.map(Math.floor);
  let left = Math.round(room - ints.reduce((a, b) => a + b, 0)), i = n - 1;
  while (left > 0) { ints[i] = (ints[i] as number) + 1; left--; i = i ? i - 1 : n - 1; }
  return ints;
}
/** computeRects options: metrics plus each panel's minimum [w, h]. */
export interface RectOptions extends Partial<Metrics> { mins?: Record<string, readonly [number, number]> }
type Opts = Metrics & RectOptions;
function nodeMin(n: LayoutNode, o: Opts): { w: number; h: number } {
  if (isGroup(n)) {
    const ms = n.panels.map((p) => o.mins?.[p] ?? [120, 80]);
    return { w: Math.max(...ms.map((m) => m[0])), h: Math.max(...ms.map((m) => m[1])) + o.header };
  }
  const along = n.t === "row" ? "w" : "h", cross = n.t === "row" ? "h" : "w", r = { w: 0, h: 0 };
  n.kids.forEach((k, i) => {
    if (i) r[along] += o.gap;
    if (isCollapsed(k)) { r[along] += o.strip; return; }
    const m = nodeMin(k, o);
    r[along] += m[along]; r[cross] = Math.max(r[cross], m[cross]);
  });
  return r;
}
export interface StripRect { id: string; mode: "horizontal" | "vertical"; rect: Rect; groups: string[]; panels: { panel: string; group: string }[] }
export interface SplitterRect { key: string; split: string; a: number; b: number; axis: "row" | "col"; rect: Rect }
export interface SplitInfo { axis: "row" | "col"; px: Record<number, number>; min: Record<number, number> }
export interface Rects { area: Rect; groups: Record<string, Rect>; strips: StripRect[]; splitters: SplitterRect[]; splits: Record<string, SplitInfo> }
/** The layout in pixels: open groups, strips, splitters between open neighbours, and each split's sizes. */
export function computeRects(layout: Layout, area: Rect, opts: RectOptions = {}): Rects {
  const o: Opts = { ...METRICS, ...opts };
  const out: Rects = { area, groups: {}, strips: [], splitters: [], splits: {} };
  const place = (n: LayoutNode, r: Rect): void => {
    if (isGroup(n)) { out.groups[n.id] = r; return; }
    const horiz = n.t === "row", total = horiz ? r.w : r.h, mode = horiz ? "vertical" : "horizontal";
    const open = n.kids.map((k, i) => (isCollapsed(k) ? -1 : i)).filter((i) => i >= 0);
    const avail = total - o.gap * (n.kids.length - 1) - o.strip * (n.kids.length - open.length);
    const mins = open.map((i) => nodeMin(n.kids[i] as LayoutNode, o)[horiz ? "w" : "h"]);
    const px = allot(avail, open.map((i) => n.sizes[i] as number), mins);
    const info: SplitInfo = { axis: n.t, px: {}, min: {} };
    open.forEach((i, j) => { info.px[i] = px[j] as number; info.min[i] = mins[j] as number; });
    out.splits[n.id] = info;
    let pos = horiz ? r.x : r.y;
    const seen = new Set<string>();
    n.kids.forEach((k, i) => {
      const size = open.includes(i) ? (info.px[i] as number) : o.strip;
      const rect = horiz ? { x: pos, y: r.y, w: size, h: r.h } : { x: r.x, y: pos, w: r.w, h: size };
      if (open.includes(i)) place(k, rect);
      else {
        const inner = groups(k);
        out.strips.push({ id: k.id, mode, rect, groups: inner.map((x) => x.id), panels: inner.flatMap((x) => x.panels.map((p) => ({ panel: p, group: x.id }))) });
      }
      pos += size;
      if (i === n.kids.length - 1) return;
      const a = open.filter((j) => j <= i).pop(), b = open.find((j) => j > i);
      if (a !== undefined && b !== undefined && !seen.has(`${a}:${b}`)) {
        seen.add(`${a}:${b}`);
        out.splitters.push({ key: `${n.id}:${(n.kids[a] as LayoutNode).id}:${(n.kids[b] as LayoutNode).id}`, split: n.id, a, b, axis: n.t, rect: horiz ? { x: pos, y: r.y, w: o.gap, h: r.h } : { x: r.x, y: pos, w: r.w, h: o.gap } });
      }
      pos += o.gap;
    });
  };
  place(layout.root, area);
  return out;
}
/** Splitter: moves `delta` px between children a and b, minimums kept; the other neighbours do not move. */
export function resizeSplit(layout: Layout, splitId: string, a: number, b: number, delta: number, rects: Rects): Layout {
  const info = rects.splits[splitId], pa = info?.px[a], pb = info?.px[b];
  if (!info || pa === undefined || pb === undefined || pa + pb <= 0) return layout;
  const lo = Math.min(info.min[a] as number, pa), hi = Math.max(pa + pb - (info.min[b] as number), lo);
  const next = clamp(pa + delta, lo, hi);
  const L = clone(layout), n = findNode(L, splitId) as SplitNode, sum = (n.sizes[a] as number) + (n.sizes[b] as number);
  n.sizes[a] = (sum * next) / (pa + pb);
  n.sizes[b] = sum - n.sizes[a];
  return L;
}
/** Double click: the open children of a split become equal (collapsed ones keep their stored share). */
export function equalize(layout: Layout, splitId: string): Layout {
  const L = clone(layout), n = findNode(L, splitId);
  if (!n || isGroup(n)) return layout;
  const open = n.kids.map((k, i) => (isCollapsed(k) ? -1 : i)).filter((i) => i >= 0);
  const sum = open.reduce((a, i) => a + (n.sizes[i] as number), 0);
  for (const i of open) n.sizes[i] = sum / open.length;
  return L;
}
/** The five drop zones inside a group (the same bounds hitTest uses). */
export function zoneRects(r: Rect, header: number = METRICS.header): Record<Zone, Rect> {
  const y = r.y + header, h = Math.max(0, r.h - header), ew = r.w * 0.25, eh = h * 0.25;
  return {
    left: { x: r.x, y, w: ew, h }, right: { x: r.x + r.w - ew, y, w: ew, h },
    top: { x: r.x + ew, y, w: r.w - 2 * ew, h: eh }, bottom: { x: r.x + ew, y: y + h - eh, w: r.w - 2 * ew, h: eh },
    center: { x: r.x + ew, y: y + eh, w: r.w - 2 * ew, h: h - 2 * eh },
  };
}
const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
function splitPreview(r: Rect, zone: Zone, frac = 0.5): Rect {
  if (zone === "left") return { x: r.x, y: r.y, w: r.w * frac, h: r.h };
  if (zone === "right") return { x: r.x + r.w * (1 - frac), y: r.y, w: r.w * frac, h: r.h };
  if (zone === "top") return { x: r.x, y: r.y, w: r.w, h: r.h * frac };
  if (zone === "bottom") return { x: r.x, y: r.y + r.h * (1 - frac), w: r.w, h: r.h * frac };
  return r;
}
export interface Hit { target: string; zone: Zone; rect: Rect; onTabs?: boolean }
/** The drop target under the pointer while dragging, or null. The outer edge docks to the whole workspace. */
export function hitTest(rects: Rects, x: number, y: number, opts: Partial<Metrics> = {}): Hit | null {
  const o = { ...METRICS, ...opts }, A = rects.area;
  if (inside({ x: A.x - o.inset, y: A.y - o.inset, w: A.w + 2 * o.inset, h: A.h + 2 * o.inset }, x, y)) {
    const d: [Side, number][] = [["left", x - A.x], ["right", A.x + A.w - x], ["top", y - A.y], ["bottom", A.y + A.h - y]];
    const near = d.sort((p, q) => p[1] - q[1])[0] as [Side, number];
    if (near[1] < o.edge) return { target: ROOT, zone: near[0], rect: splitPreview(A, near[0], 0.26) };
  }
  for (const s of rects.strips) if (inside(s.rect, x, y)) return { target: s.groups[0] as string, zone: "center", rect: s.rect };
  for (const [id, r] of Object.entries(rects.groups)) {
    if (!inside(r, x, y)) continue;
    if (y < r.y + o.header) return { target: id, zone: "center", rect: r, onTabs: true };
    const zs = zoneRects(r, o.header), zone = (Object.keys(zs) as Zone[]).find((k) => inside(zs[k], x, y)) ?? "center";
    return { target: id, zone, rect: splitPreview(r, zone) };
  }
  return null;
}

// ------------------------------------------------------------------ save, restore, new panels
/** The layout as plain JSON. */
export const serialize = (layout: Layout): Layout => clone({ v: layout.v, seq: layout.seq, max: layout.max, root: layout.root });
function placeOne(L: Layout, def: PanelDef, near: string | null): void {
  const p = def.place ?? {}, tgt = near ? groupOf(L, near) : null;
  if (tgt && (p.zone ?? "center") === "center") { tgt.panels.push(def.id); return; }
  const added = newGroup(L, [def.id], !!p.collapsed);
  dockBeside(L, tgt ?? L.root, added, tgt ? (p.zone as Zone) : "right", p.size ?? 0.25);
}
/** Adds the panels the layout lacks, each at its `place` (else the right edge). */
export function addMissing(layout: Layout, defs: readonly PanelDef[]): Layout {
  const L = clone(layout);
  if (!allPanels(L.root).length && defs.length) {
    const first = defs[0] as PanelDef;
    L.root = newGroup(L, [first.id]);
  }
  let todo = defs.filter((d) => !allPanels(L.root).includes(d.id));
  while (todo.length) {
    const have = allPanels(L.root);
    const ready = todo.filter((d) => d.place?.near && have.includes(d.place.near));
    for (const d of ready.length ? ready : todo.slice(0, 1)) placeOne(L, d, ready.length ? (d.place?.near as string) : null);
    normalize(L);
    todo = defs.filter((d) => !allPanels(L.root).includes(d.id));
  }
  return normalize(L);
}
/** Reads a saved layout: null when broken or of another version; unknown and repeated panels drop, missing ones are added. */
export function restoreLayout(raw: unknown, defs: readonly PanelDef[]): Layout | null {
  const R = raw as Partial<Layout> | null;
  if (!R || typeof R !== "object" || R.v !== LAYOUT_V || !R.root) return null;
  const known = new Set(defs.map((d) => d.id)), seen = new Set<string>();
  const L: Layout = { v: LAYOUT_V, seq: 1, max: null, root: null as unknown as LayoutNode };
  const map = new Map<string, string>();
  const read = (n: Record<string, unknown> | null, depth: number): LayoutNode | null => {
    if (!n || typeof n !== "object" || depth > 12) return null;
    if (n["t"] === "tabs") {
      if (!Array.isArray(n["panels"])) return null;
      const panels: string[] = [];
      for (const p of n["panels"] as unknown[]) if (typeof p === "string" && known.has(p) && !seen.has(p)) { seen.add(p); panels.push(p); }
      if (!panels.length) return null;
      const active = n["active"] as string;
      const out: TabsNode = { t: "tabs", id: fresh(L, "g"), panels, active: panels.includes(active) ? active : (panels[0] as string), collapsed: n["collapsed"] === true };
      const px = n["px"];
      if (typeof px === "number" && Number.isFinite(px) && px > 0) out.px = px;
      map.set(String(n["id"]), out.id);
      return out;
    }
    if ((n["t"] !== "row" && n["t"] !== "col") || !Array.isArray(n["kids"])) return null;
    const kids = n["kids"] as Record<string, unknown>[], sizes = n["sizes"] as unknown[] | undefined;
    const out: SplitNode = { t: n["t"], id: fresh(L, "s"), kids: [], sizes: [] };
    kids.forEach((k, i) => {
      const c = read(k, depth + 1);
      if (!c) return;
      const w = Number(sizes?.[i]);
      out.kids.push(c); out.sizes.push(Number.isFinite(w) && w > 0 ? w : 1 / kids.length);
    });
    return out.kids.length ? out : null;
  };
  const root = read(R.root as unknown as Record<string, unknown>, 0);
  if (!root) return null;
  L.root = root;
  L.max = (R.max && map.get(R.max)) ?? null;
  return addMissing(normalize(L), defs);
}
/** A layout from a preset tree, fitted to the panels at hand. */
export const presetLayout = (preset: Preset | undefined, defs: readonly PanelDef[]): Layout | null =>
  preset ? restoreLayout(fromTree(preset.tree()), defs) : null;
/** Every panel in one tab group (the fallback with no preset). */
export const singleLayout = (defs: readonly PanelDef[], active?: string | null): Layout => {
  const panels = defs.map((d) => d.id);
  return fromTree({ t: "tabs", panels, active: active && panels.includes(active) ? active : (panels[0] ?? null), collapsed: false });
};
/** A panel goes back to its default place (its own `place`). */
export function resetPanel(layout: Layout, def: PanelDef, defs: readonly PanelDef[]): Layout {
  const L = clone(layout);
  detach(L, def.id);
  if (!allPanels(L.root).length) return layout;
  L.max = null;
  normalize(L);
  return addMissing(L, defs);
}
