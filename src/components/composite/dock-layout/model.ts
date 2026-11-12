// DockLayout state: a binary tree of splits whose leaves are tab groups, plus floating groups and minimized panels.
// Plain JSON (save / load it as is). Every operation takes a state and returns a new one; nothing here touches the DOM.

/** A tab group: panel ids in tab order and the active one. */
export interface DockGroupNode { type: "group"; id: string; panels: string[]; active: string | null }
/** Two areas side by side (`row`) or stacked (`column`); `share` is the first area's part (0..1). */
export interface DockSplitNode { type: "split"; dir: "row" | "column"; share: number; a: DockNode; b: DockNode }
export type DockNode = DockGroupNode | DockSplitNode;
/** A group floating above the layout; position and size in px from the layout's top-start corner. */
export interface DockFloating { group: DockGroupNode; x: number; y: number; w: number; h: number }
/** A minimized panel and the group it came from (restored there when that group still exists). */
export interface DockMinimized { panel: string; from: string | null }
export interface DockState {
  version: 1;
  root: DockNode | null;
  floating: DockFloating[];
  minimized: DockMinimized[];
  /** The maximized group's id. */
  maximized: string | null;
}
/** Logical sides: start / end follow the writing direction. */
export type DockSide = "start" | "end" | "top" | "bottom";
/** Where a dragged panel lands: a side of a group (a new split), its centre (a tab), or a tab position. */
export type DockZone = DockSide | "center";

let seq = 0;
export const groupId = (): string => `g${(++seq).toString(36)}${Date.now().toString(36).slice(-3)}`;
export const group = (panels: string[], active?: string | null): DockGroupNode => ({ type: "group", id: groupId(), panels, active: active ?? panels[0] ?? null });
export const split = (dir: "row" | "column", a: DockNode, b: DockNode, share = 0.5): DockSplitNode => ({ type: "split", dir, share, a, b });
export const emptyState = (root: DockNode | null = null): DockState => ({ version: 1, root, floating: [], minimized: [], maximized: null });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Every group: docked first (tree order), then floating. */
export function groups(s: DockState): DockGroupNode[] {
  const out: DockGroupNode[] = [];
  const walk = (n: DockNode | null): void => { if (!n) return; if (n.type === "group") out.push(n); else { walk(n.a); walk(n.b); } };
  walk(s.root);
  for (const f of s.floating) out.push(f.group);
  return out;
}
export const findGroup = (s: DockState, id: string): DockGroupNode | undefined => groups(s).find((g) => g.id === id);
export const groupOf = (s: DockState, panel: string): DockGroupNode | undefined => groups(s).find((g) => g.panels.includes(panel));
export const isFloating = (s: DockState, gid: string): boolean => s.floating.some((f) => f.group.id === gid);
/** Every panel id placed in the layout (docked, floating or minimized). */
export const placed = (s: DockState): string[] => [...groups(s).flatMap((g) => g.panels), ...s.minimized.map((m) => m.panel)];

/** Replace the node `target` (by identity) in the tree. */
function replace(n: DockNode | null, target: DockNode, by: DockNode | null): DockNode | null {
  if (!n) return n;
  if (n === target) return by;
  if (n.type === "split") {
    const a = replace(n.a, target, by), b = replace(n.b, target, by);
    if (!a) return b; if (!b) return a;
    n.a = a; n.b = b;
  }
  return n;
}

/** Take a panel out of wherever it is; an emptied group disappears (its split collapses into the sibling). */
export function removePanel(state: DockState, panel: string): DockState {
  const s = clone(state);
  s.minimized = s.minimized.filter((m) => m.panel !== panel);
  const g = groupOf(s, panel);
  if (!g) return s;
  const i = g.panels.indexOf(panel);
  g.panels.splice(i, 1);
  if (g.active === panel) g.active = g.panels[Math.min(i, g.panels.length - 1)] ?? null;
  if (g.panels.length) return s;
  if (s.maximized === g.id) s.maximized = null;
  const f = s.floating.findIndex((x) => x.group.id === g.id);
  if (f >= 0) s.floating.splice(f, 1);
  else s.root = replace(s.root, g, null);
  return s;
}

/**
 * Put `panel` into the group `target` (zone "center", at `index` among its tabs) or next to it (a side: a new group in
 * a new split). `target` "@root" docks along an edge of the whole layout. The panel is removed from its old place first.
 */
export function insertPanel(state: DockState, panel: string, target: string, zone: DockZone, index?: number): DockState {
  // dropping a group's only panel on a side of that same group would split it with nothing: nothing changes
  const from = groupOf(state, panel);
  if (from && from.id === target && from.panels.length === 1 && zone !== "center") return state;
  const s = removePanel(state, panel);
  if (target === "@root" || !s.root && !s.floating.length) {
    const g = group([panel]);
    if (!s.root) s.root = g;
    else if (zone === "center") return insertPanel(s, panel, firstGroup(s)?.id ?? "@root", "center");
    else s.root = sideSplit(zone, g, s.root, 0.28);
    return s;
  }
  const t = findGroup(s, target);
  if (!t) return insertPanel(s, panel, "@root", zone === "center" ? "end" : zone);
  if (zone === "center") {
    t.panels.splice(index == null ? t.panels.length : Math.max(0, Math.min(index, t.panels.length)), 0, panel);
    t.active = panel;
    return s;
  }
  const g = group([panel]);
  const fl = s.floating.find((f) => f.group === t);
  if (fl) { // a side of a floating group: dock both next to each other at the layout's edge
    s.floating = s.floating.filter((f) => f !== fl);
    const pair = sideSplit(zone, g, t, 0.5);
    s.root = s.root ? sideSplit("end", pair, s.root, 0.35) : pair;
    return s;
  }
  s.root = replace(s.root, t, sideSplit(zone, g, t, 0.5));
  return s;
}

/** A split with `added` on `side` of `rest`. */
function sideSplit(side: DockSide, added: DockNode, rest: DockNode, share: number): DockSplitNode {
  const dir = side === "start" || side === "end" ? "row" : "column";
  return side === "start" || side === "top" ? split(dir, added, rest, share) : split(dir, rest, added, 1 - share);
}

export const firstGroup = (s: DockState): DockGroupNode | undefined => groups(s)[0];

/** Float `panel` in a new window at x, y (px), w × h. */
export function floatPanel(state: DockState, panel: string, rect: { x: number; y: number; w: number; h: number }): DockState {
  const s = removePanel(state, panel);
  s.floating.push({ group: group([panel]), ...rect });
  return s;
}

/** Minimize: the panel leaves the layout and waits in the tray. */
export function minimizePanel(state: DockState, panel: string): DockState {
  const from = groupOf(state, panel)?.id ?? null;
  const s = removePanel(state, panel);
  s.minimized.push({ panel, from });
  return s;
}

/** Bring a minimized panel back to its group (or the first group, or a new root). */
export function restorePanel(state: DockState, panel: string): DockState {
  const m = state.minimized.find((x) => x.panel === panel);
  const target = (m?.from && findGroup(state, m.from)?.id) || firstGroup(state)?.id || "@root";
  return insertPanel(state, panel, target, target === "@root" ? "end" : "center");
}

/** Make `panel` the active tab of its group. */
export function activate(state: DockState, panel: string): DockState {
  const s = clone(state);
  const g = groupOf(s, panel);
  if (g) g.active = panel;
  return s;
}

/** Drop panels that no longer exist (a saved layout from an older version) and keep the rest valid. */
export function sanitize(state: unknown, known: (id: string) => boolean): DockState | null {
  const s = state as Partial<DockState> | null;
  if (!s || s.version !== 1 || typeof s !== "object") return null;
  let out: DockState = clone({ version: 1, root: s.root ?? null, floating: s.floating ?? [], minimized: s.minimized ?? [], maximized: s.maximized ?? null });
  for (const id of placed(out)) if (!known(id)) out = removePanel(out, id);
  const seen = new Set<string>();
  for (const g of groups(out)) for (const p of [...g.panels]) { if (seen.has(p)) out = removePanel(out, p); seen.add(p); }
  if (out.maximized && !findGroup(out, out.maximized)) out.maximized = null;
  return out;
}

/** Build a state from a compact description: `["a", "b"]` is a group, `{ row: [x, y], share }` / `{ column: [x, y] }` a split. */
export type DockSpec = readonly string[] | { row: readonly [DockSpec, DockSpec]; share?: number } | { column: readonly [DockSpec, DockSpec]; share?: number };
export function fromSpec(spec: DockSpec | null | undefined): DockState {
  const build = (x: DockSpec): DockNode => {
    if (Array.isArray(x)) return group([...(x as readonly string[])]);
    const o = x as { row?: readonly [DockSpec, DockSpec]; column?: readonly [DockSpec, DockSpec]; share?: number };
    const pair = (o.row ?? o.column) as readonly [DockSpec, DockSpec];
    return split(o.row ? "row" : "column", build(pair[0]), build(pair[1]), o.share ?? 0.5);
  };
  return emptyState(spec ? build(spec) : null);
}
