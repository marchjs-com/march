// SunburstChart: a hierarchy as rings, one ring per level (march/charts). Folder: src/components/data/sunburst-chart/;
// shared chart parts (frame, tooltip, legend, data table, motion, polar geometry, hierarchy) are in src/charts/.
// Nodes are a presence list keyed by their path. Every arc is drawn from its base angles (the partition of the whole
// tree) mapped through the zoomed node: drilling in tweens every arc to its new place (the zoomed node's span opens to
// the full circle, the next levels follow), nodes that drop out of view slide off or collapse before they are removed.
import "./sunburst-chart.css";
import { signal, computed, read, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { formatter, num, seriesClass, colorStyle, useSize, attr, textWidth, navIndex, each, f1,
  type MaybeReactive, type DataProp, type FormatSpec, type ChartBaseProps, type TooltipProp } from "../../../charts/util.ts";
import { tween, presence, animateOf, type AnimateProp, type Present } from "../../../charts/motion.ts";
import { Frame, tooltipState, showTip, tipBody } from "../../../charts/parts.ts";
import { TAU, polar, arcPath } from "../../../charts/arc.ts";
import { hierarchy, descendants, partition, type HNode } from "../../../charts/hier.ts";
import { clamp, later, type Handler } from "../../../core/util.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import type { Crumb } from "../../navigation/breadcrumbs/index.ts";

// The path bar is March's Breadcrumbs, loaded as its own chunk on first use: a chart that never shows the path (or a
// page that does not need it yet) does not download the breadcrumbs, their sibling menus and popover.
type CrumbsFn = typeof import("../../navigation/breadcrumbs/index.ts").Breadcrumbs;
const crumbsMod = signal<{ c: CrumbsFn } | null>(null);
let crumbsLoading = false;
const crumbsComp = (): CrumbsFn | null => {
  const m = crumbsMod();
  if (!m && !crumbsLoading) { crumbsLoading = true; void import("../../navigation/breadcrumbs/index.ts").then((x) => crumbsMod.set({ c: x.Breadcrumbs })); }
  return m?.c ?? null;
};

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;
type Get<D> = ((d: D) => unknown) | string | undefined;

/** Node passed to `tooltip`, `center`, `onSelect` and `onZoom` of a sunburst. */
export interface SunburstPoint<D> {
  key: string; label: string; value: number; depth: number; datum: D;
  /** Labels from the top level down to this node. */
  path: string[];
  /** Share of its parent (0..1). */
  share: number;
  /** Share of the whole (0..1). */
  total: number;
  hasChildren: boolean;
}
export interface SunburstChartProps<D = unknown> extends ChartBaseProps {
  /** The tree: one root row or a list of top rows; rows hold their `children`. An array, a signal or a function returning one. @tr Ağaç: tek bir kök satır ya da üst satırların listesi; satırlar `children` taşır. Dizi, sinyal ya da onu döndüren fonksiyon. */
  data?: D | DataProp<D>;
  /** A row's children: a key or getter (default "children"). @tr Bir satırın çocukları: anahtar ya da getter (varsayılan "children"). */
  childrenOf?: ((d: D) => readonly D[] | null | undefined) | string | undefined;
  /** A leaf's value: a key or getter (default "value"); a parent sums its children. @tr Bir yaprağın değeri: anahtar ya da getter (varsayılan "value"); üst düğüm çocuklarını toplar. */
  value?: Get<D>;
  /** A row's label: a key or getter (default `label`, then `name`). @tr Bir satırın etiketi: anahtar ya da getter (varsayılan `label`, sonra `name`). */
  label?: Get<D>;
  /** A row's stable key: a key or getter (default its path of labels). @tr Bir satırın kalıcı anahtarı: anahtar ya da getter (varsayılan etiket yolu). */
  id?: Get<D>;
  /** Levels shown at once below the zoomed node (default 3). @tr Yakınlaşılan düğümün altında aynı anda görünen düzey sayısı (varsayılan 3). */
  maxDepth?: Opt<number>;
  /** The middle hole as a share of the radius 0..0.8 (default 0.3). @tr Ortadaki boşluk, yarıçapın oranı olarak 0..0.8 (varsayılan 0.3). */
  innerRadius?: Opt<number>;
  /** Gap between arcs in radians (default 0.006). @tr Yaylar arasındaki boşluk, radyan (varsayılan 0.006). */
  padAngle?: Opt<number>;
  /** Labels on arcs wide enough to hold them (default true). @tr Yeterince geniş yaylarda etiketler (varsayılan true). */
  labels?: Opt<boolean>;
  /** Click / Enter on a node with children zooms into it (default true). @tr Çocuklu bir düğüme tıklamak / Enter onu yakınlaştırır (varsayılan true). */
  drill?: Opt<boolean>;
  /** The path to the zoomed node above the chart, as March Breadcrumbs (default true). @tr Yakınlaşılan düğüme giden yol, grafiğin üstünde March Breadcrumbs olarak (varsayılan true). */
  breadcrumbs?: Opt<boolean>;
  /** Key of the node to zoom into from outside (null / missing: the whole tree). @tr Dışarıdan yakınlaşılacak düğümün anahtarı (null / yok: bütün ağaç). */
  focus?: Opt<string>;
  /** Name of the whole tree in the center and the path (default "All", or the root row's label). @tr Ağacın tamamının adı, ortada ve yolda (varsayılan "All" ya da kök satırın etiketi). */
  rootLabel?: Opt<string>;
  /** The middle: by default the zoomed node's label and value; a value, `(node) => content`, or `false` for none. @tr Orta alan: varsayılan olarak yakınlaşılan düğümün etiketi ve değeri; bir değer, `(node) => content` ya da hiçbiri için `false`. */
  center?: Opt<unknown>;
  /** Value format for center, tooltip and table: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Orta alan, araç ipucu ve tablo için değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** `true` (default), `false`, or `(node) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(node) => content`. */
  tooltip?: TooltipProp<SunburstPoint<D>>;
  /** Called with the node on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki düğümde Enter / Space'e basılınca düğümle çağrılır. */
  onSelect?: Handler<[p: SunburstPoint<D>]> | undefined;
  /** Called with the new zoomed node after a drill (null back at the whole tree). @tr Yakınlaşmadan sonra yeni düğümle çağrılır (bütün ağaca dönünce null). */
  onDrill?: Handler<[p: SunburstPoint<D> | null]> | undefined;
  /** Arcs open from 12 o'clock, tween on zoom and on data changes, and collapse when they leave: `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` (stagger: ring by ring) or `(ctx) => …`. @tr Yaylar saat 12'den açılır, yakınlaşmada ve veri değişince kayar, giderken kapanır: `true` (varsayılan, yay), `false`, easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` (stagger: halka halka) ya da `(ctx) => …`. */
  animate?: AnimateProp | (() => AnimateProp);
}

interface Item<D> { key: string; label: string; value: number; depth: number; branch: number; b0: number; b1: number; node: HNode<D> }
interface View { f0: number; f1: number; depth: number; levels: number }
interface Arc { a0: number; a1: number; r0: number; r1: number }

const mix = (depth: number): string => `${Math.max(38, 100 - (depth - 1) * 20)}%`;

/** Sunburst chart with drill-in zoom. See docs.md for props. */
export function SunburstChart<D>(props: SunburstChartProps<D>): Element {
  const size = useSize(props, 340, 340);
  const hidden = signal(new Set<string>()), active = signal<string | null>(null), focus = signal("");
  const tip = tooltipState();
  const how = (): AnimateProp => animateOf(props.animate);
  let svg: Element | null = null;
  // entering arcs: the first draw opens from 12 o'clock; after a zoom they come from where the old view had them
  let opened = false, prevView: View | null = null;
  later(() => { opened = true; }, 0);

  const root = computed(() => {
    const raw = typeof props.data === "function" ? (props.data as () => unknown)() : props.data;
    const list = raw == null ? [] : Array.isArray(raw) ? raw : typeof raw === "object" && Symbol.iterator in (raw as object) ? [...(raw as Iterable<D>)] : raw;
    // a list gets our own synthetic root (hier.ts wraps a list as `{ children }`, which a custom `childrenOf` cannot read)
    const top = {} as D, ch = props.childrenOf, lb = props.label, id = props.id;
    const get = (f: Get<D>, d: D, def: (d: D) => unknown): unknown => (typeof f === "function" ? f(d) : f != null ? (d as Record<string, unknown> | null)?.[f] : def(d));
    const rows = Array.isArray(list) ? list as D[] : null;
    return hierarchy<D>(rows ? top : list as D, {
      children: (d) => (d === top ? rows : get(ch, d, (x) => (x as { children?: unknown } | null)?.children) as readonly D[] | null | undefined),
      value: props.value,
      label: (d) => (d === top ? "" : get(lb, d, (x) => (x as { label?: unknown } | null)?.label ?? (x as { name?: unknown } | null)?.name)),
      ...(id != null ? { key: (d: D) => (d === top ? "" : get(id, d, () => "")) } : {}),
    });
  });
  // the root with the legend-hidden top branches left out (partition only walks `children` and reads `value`)
  const tree = computed((): HNode<D> => {
    const r = root(), kids = r.children.filter((c) => !hidden().has(c.key));
    return { ...r, children: kids, value: kids.reduce((a, c) => a + c.value, 0) };
  });
  const all = computed(() => {
    const r = tree(), part = partition(r), out = new Map<string, Item<D>>();
    const add = (n: HNode<D>): void => { const [b0, b1] = part.get(n) ?? [0, 0]; out.set(n.key, { key: n.key, label: n.label, value: n.value, depth: n.depth, branch: n.branch, b0, b1, node: n }); };
    add(r);
    for (const n of descendants(r)) add(n);
    return out;
  });
  const rootItem = (): Item<D> => all().get(tree().key) as Item<D>;
  const focused = computed((): Item<D> => all().get(focus()) ?? rootItem());
  const maxDepth = computed(() => Math.max(1, Math.round(num(read(props.maxDepth)) ?? 3)));
  const visible = computed((): Item<D>[] => {
    const f = focused(), m = all(), base = f.key === tree().key ? tree() : f.node;
    return descendants(base, maxDepth()).map((n) => m.get(n.key) as Item<D>).filter((x) => x && x.value > 0);
  });
  const view = computed((): View => {
    const f = focused(), deep = Math.max(1, ...visible().map((x) => x.depth - f.depth));
    return { f0: f.b0, f1: f.b1, depth: f.depth, levels: Math.min(maxDepth(), deep) };
  }, { equals: (a, b) => !!a && a.f0 === b.f0 && a.f1 === b.f1 && a.depth === b.depth && a.levels === b.levels });
  const geo = computed(() => {
    const w = size.width(), hh = size.height(), R = Math.max(20, Math.min(w, hh) / 2 - 4);
    return { cx: w / 2, cy: hh / 2, R, r0: R * clamp(num(read(props.innerRadius)) ?? 0.3, 0, 0.8) };
  }, { equals: (a, b) => !!a && a.cx === b.cx && a.cy === b.cy && a.R === b.R && a.r0 === b.r0 });
  const pres = presence(visible, (x) => x.key, how);

  /** Where an arc with base angles [b0, b1] at `depth` is drawn in view `v`. */
  const arcIn = (x: { depth: number; b0: number; b1: number }, v: View): Arc => {
    const g = geo(), span = v.f1 - v.f0 || 1, m = (a: number): number => clamp((a - v.f0) / span, 0, 1) * TAU;
    const rel = x.depth - v.depth, th = (g.R - g.r0) / v.levels;
    const [r0, r1] = rel < 1 ? [g.r0, g.r0] : rel > v.levels ? [g.R, g.R] : [g.r0 + (rel - 1) * th, g.r0 + rel * th];
    return { a0: m(x.b0), a1: m(x.b1), r0, r1 };
  };
  const targetOf = (it: Present<Item<D>>): Arc => {
    const cur = all().get(it.key), v = view();
    if (!it.leaving) return arcIn(it, v);
    if (cur) return arcIn(cur, v); // still in the tree, only out of view: it slides off with the zoom
    const a = arcIn(it, v), mid = (a.a0 + a.a1) / 2; // removed: it closes on its middle
    return { ...a, a0: mid, a1: mid };
  };

  const pointOf = (x: Item<D>): SunburstPoint<D> => {
    const path: string[] = [];
    for (let n: HNode<D> | null = x.node; n && n.depth > 0; n = n.parent) path.unshift(n.label);
    const parent = x.node.parent, whole = tree().value;
    return { key: x.key, label: x.label || rootName(), value: x.value, depth: x.depth, datum: x.node.datum, path, share: parent && parent.value ? x.value / parent.value : 1, total: whole ? x.value / whole : 0, hasChildren: x.node.children.length > 0 };
  };
  const rootName = (): string => read(props.rootLabel) ?? (tree().label || t`All`);
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));

  const show = (key: string | null): void => {
    active.set(key);
    const x = key == null ? undefined : all().get(key), opt = read(props.tooltip);
    if (!x || opt === false) return void tip.at.set(null);
    const g = geo(), a = arcIn(x, view()), mid = (a.a0 + a.a1) / 2, [px, py] = polar(g.cx, g.cy, (a.r0 + a.r1) / 2, mid), p = pointOf(x);
    const content = typeof opt === "function" ? () => opt(p)
      : () => tipBody(p.path.join(" › "), [{ label: `${Math.round(p.share * 100)}%`, value: fmt()(p.value), index: x.branch }], props.colors);
    showTip(tip, svg, size.width(), px, py, content);
  };
  const hide = (): void => { active.set(null); tip.at.set(null); };
  const zoomTo = (key: string): void => {
    const x = all.peek().get(key), top = key === tree.peek().key;
    if (key === focused.peek().key || (!top && !x?.node.children.some((c) => c.value > 0))) return;
    prevView = view.peek();
    later(() => { prevView = null; }, 0);
    focus.set(key);
    hide();
    const f = focused.peek();
    props.onDrill?.(f.key === tree.peek().key ? null : pointOf(f));
  };
  // drill from outside: `focus` (a node key) moves the zoom like a click would
  effect(() => { const k = read(props.focus); untrack(() => zoomTo(k ?? tree().key)); });
  const up = (): void => { const f = focused.peek(); if (f.key !== tree.peek().key) zoomTo(f.node.parent?.key ?? tree.peek().key); };
  const pick = (key: string): void => {
    const x = all.peek().get(key);
    if (!x) return;
    props.onSelect?.(pointOf(x));
    if (read(props.drill) !== false && x.node.children.some((c) => c.value > 0)) zoomTo(key);
  };
  // keyboard: ← → along a ring, ↑ to the parent, ↓ to the first child, Enter zooms in, Escape / Backspace zoom out
  const ringOf = (depth: number): Item<D>[] => visible().filter((x) => x.depth === depth).sort((a, b) => a.b0 - b.b0);
  const onKeyDown = (e: KeyboardEvent): void => {
    const cur = active.peek() == null ? undefined : all.peek().get(active.peek() as string), f = focused.peek();
    if (isActivateKey(e)) { e.preventDefault(); if (cur) pick(cur.key); return; }
    if (e.key === "Escape" || e.key === "Backspace") {
      if (f.key !== tree.peek().key) { e.preventDefault(); up(); } else hide();
      return;
    }
    if (!visible().length) return;
    if (!cur) { if (navIndex(e.key, -1, 0, 0) != null) { e.preventDefault(); show(ringOf(f.depth + 1)[0]?.key ?? null); } return; }
    if (e.key === "ArrowUp") { e.preventDefault(); if (cur.depth - 1 > f.depth && cur.node.parent) show(cur.node.parent.key); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); const c = ringOf(cur.depth + 1).find((x) => x.node.parent === cur.node); if (c) show(c.key); return; }
    const ring = ringOf(cur.depth), i = navIndex(e.key, ring.findIndex((x) => x.key === cur.key), 0, ring.length - 1);
    if (i == null) return;
    e.preventDefault();
    show(ring[i]?.key ?? null);
  };
  const onPath = (key: string): boolean => {
    for (let n: HNode<D> | null | undefined = active() == null ? null : all().get(active() as string)?.node; n; n = n.parent) if (n.key === key) return true;
    return false;
  };
  const pad = (): number => clamp(num(read(props.padAngle)) ?? 0.006, 0, 0.1);

  /** A label that fits along the arc (tangential), across it (radial), or none. */
  const labelOf = (a: Arc, text: string): { x: number; y: number; rot: number } | null => {
    const w = textWidth(text, 6.2) + 8, th = a.r1 - a.r0, rm = (a.r0 + a.r1) / 2, span = a.a1 - a.a0, mid = (a.a0 + a.a1) / 2;
    if (th < 12 || span <= 0) return null;
    const [x, y] = polar(geo().cx, geo().cy, rm, mid);
    const deg = (mid * 180) / Math.PI;
    if (span * rm >= w) return { x, y, rot: mid > Math.PI / 2 && mid < (3 * Math.PI) / 2 ? deg + 180 : deg };
    if (th >= w && span * rm >= 12) return { x, y, rot: mid > Math.PI ? deg + 90 : deg - 90 };
    return null;
  };

  const body = [
    h("g", { class: () => `m-chart-plot m-sunburst-plot${active() != null ? " m-sunburst-focus" : ""}`, onPointerLeave: hide },
      each<Present<Item<D>>>({ each: pres.items, key: (x) => x.key, children: (x) => {
        const key = x().key;
        const a = tween(() => targetOf(x()), ["a0", "a1", "r0", "r1"], how,
          (to) => (prevView ? arcIn(x(), prevView) : opened ? { ...to, a1: to.a0 } : { ...to, a0: 0, a1: 0 }),
          { index: () => Math.max(0, x().depth - view().depth - 1), key, leaving: () => !!x().leaving, onSettle: () => { if (x().leaving) pres.done(key); } });
        const d = attr(() => { const v = a(), g = geo(), p = v.a1 - v.a0 > pad() * 2 ? pad() / 2 : 0; return v.a1 - v.a0 <= 1e-4 || v.r1 - v.r0 < 0.5 ? "" : arcPath(g.cx, g.cy, v.r1 - 0.5, v.r0 + 0.5, v.a0 + p, v.a1 - p); });
        const lab = attr(() => (read(props.labels) === false || x().leaving ? null : labelOf(a(), x().label)));
        return h("g", {
          class: () => `m-sunburst-node ${seriesClass(x().branch)}`, "data-label": () => x().label, "class:m-chart-active": () => active() === key, "class:m-sunburst-path": () => onPath(key),
          "class:m-chart-leaving": () => !!x().leaving, "class:m-sunburst-parent": () => x().node.children.length > 0,
          style: () => ({ ...colorStyle(props.colors, x().branch), "--m-sb-mix": mix(x().depth - view().depth) }),
          onPointerEnter: () => show(key), onClick: () => pick(key),
        },
        h("path", { class: "m-sunburst-arc", d }),
        () => { const l = lab(); return l ? h("text", { class: "m-sunburst-label", "text-anchor": "middle", "dominant-baseline": "middle", transform: `translate(${f1(l.x)},${f1(l.y)}) rotate(${f1(l.rot)})` }, x().label) : null; });
      } })),
    () => {
      if (read(props.center) === false || geo().r0 < 14) return null;
      return h("g", { class: () => `m-sunburst-center${focused().key !== tree().key ? " m-sunburst-up" : ""}`, onClick: up, onPointerEnter: hide },
        h("circle", { cx: () => geo().cx, cy: () => geo().cy, r: () => geo().r0 - 2 }),
        () => {
          const f = focused(), g = geo(), cv = read(props.center), p = pointOf(f);
          // the text shrinks to fit the hole (a long money value, a long name)
          const fit = (text: string, max: number): { "font-size": string } => ({ "font-size": `${f1(Math.max(8, Math.min(max, (2 * g.r0 - 16) / (Math.max(1, text.length) * 0.58))))}px` });
          const one = (v: unknown): Element => { const s = typeof v === "object" && v ? null : String(v ?? ""); return h("text", { class: "m-sunburst-center-value", style: s == null ? undefined : fit(s, 17), x: g.cx, y: g.cy, "text-anchor": "middle", "dominant-baseline": "middle" }, s ?? v); };
          if (typeof cv === "function") return one((cv as (p: SunburstPoint<D>) => unknown)(p));
          if (cv != null) return one(cv);
          const name = f.key === tree().key ? rootName() : f.label, val = String(fmt()(f.value));
          return [h("text", { class: "m-sunburst-center-label", style: fit(name, 11), x: g.cx, y: g.cy - 9, "text-anchor": "middle" }, name),
            h("text", { class: "m-sunburst-center-value", style: fit(val, 17), x: g.cx, y: g.cy + 12, "text-anchor": "middle" }, val)];
        });
    },
  ];

  // the path as March Breadcrumbs; a crumb with zoomable siblings opens a menu of them (jump across)
  const crumbs = computed((): Crumb[] => {
    const list: HNode<D>[] = [];
    for (let n: HNode<D> | null = focused().node; n && n.depth > 0; n = n.parent) list.unshift(n);
    const top: Crumb = { id: "m-root", label: rootName(), onSelect: () => zoomTo(tree.peek().key) };
    return [top, ...list.map((n): Crumb => {
      const sib = (n.depth === 1 ? tree().children : n.parent?.children ?? []).filter((c) => c.value > 0 && c.children.some((k) => k.value > 0));
      return { id: n.key, label: n.label, onSelect: () => zoomTo(n.key),
        ...(sib.length > 1 ? { siblings: sib.map((c) => ({ id: c.key, label: c.label, current: c.key === n.key, onSelect: () => zoomTo(c.key) })) } : {}) };
    })];
  });
  const breadcrumb = (): unknown => (read(props.breadcrumbs) === false ? null : (() => { const B = crumbsComp(); return B ? h(B, { items: crumbs, class: "m-sunburst-crumbs", label: () => t`Sunburst path` }) : null; })());

  return Frame<{ key: string; path: string; value: number; share: number }>(props, {
    kind: "sunburst", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => root().value <= 0, tip, extra: [breadcrumb],
    legend: { items: () => { const l = read(props.legend), kids = root().children; return l === false || (l == null && kids.length < 2) ? [] : kids.map((c) => ({ key: c.key, label: c.label, index: c.branch })); }, hidden },
    table: {
      caption: () => read(props.title),
      rows: () => [...all().values()].filter((x) => x.depth > 0).map((x) => { const p = pointOf(x); return { key: x.key, path: p.path.join(" › "), value: x.value, share: p.share }; }),
      columns: () => [{ label: t`Path`, value: (r) => r.path }, { label: t`Value`, value: (r) => fmt()(r.value) }, { label: t`Share`, value: (r) => `${Math.round(r.share * 100)}%` }],
    },
  });
}
