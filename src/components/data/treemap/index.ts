// Treemap: a hierarchy as nested, squarified rectangles (march/charts). Folder: src/components/data/treemap/.
// Click or Enter on a group zooms into it (its tile grows to the whole area, its children lay out again), the
// breadcrumb row and Escape / Backspace go back up. Tiles grow in, glide on every change and shrink away when they go.
import "./treemap.css";
import { signal, computed, read, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { accessor, formatter, num, seriesClass, colorStyle, useSize, attr, navIndex, each, tween, presence, animateOf, textWidth, f1,
  type MaybeReactive, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp, type AnimateProp } from "../../../charts/util.ts";
import { Frame, tooltipState, showTip, tipBody } from "../../../charts/parts.ts";
import { hierarchy, descendants, squarify, type HNode, type Rect } from "../../../charts/hier.ts";
import { colorScale, type ColorScale } from "../../../charts/color.ts";
import type { Crumb } from "../../navigation/breadcrumbs/index.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import type { Handler } from "../../../core/util.ts";

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

messages("tr", { "All": "Tümü", "Path": "Yol", "Value": "Değer", "Treemap path": "Ağaç haritası yolu" });

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;
type NodeField<D> = string | ((d: D) => unknown);

/** Point passed to `tooltip(point)`, `onSelect(point)` and `onDrill(point)`. */
export interface TreemapPoint<D> {
  /** The node's key (its path of labels, or its `id`). */
  key: string;
  /** The node's label. */
  label: string;
  /** The node's value (a group: the sum of its leaves). */
  value: number;
  /** Share of its parent (0..1). */
  share: number;
  /** Levels below the top (1 = a top-level branch). */
  depth: number;
  /** Labels from the top down to this node. */
  path: string[];
  /** True when the node has no children. */
  leaf: boolean;
  /** The row behind the node. */
  datum: D;
  /** The hierarchy node (parent, children, branch). */
  node: HNode<D>;
}
export interface TreemapProps<D = unknown> extends ChartBaseProps {
  /** One root row or a list of top rows, each with `children` (an array, signal or function returning one). @tr Tek bir kök satır ya da üst satırların listesi; her biri `children` taşır (dizi, sinyal ya da onu döndüren fonksiyon). */
  data?: MaybeReactive<D | readonly D[] | null | undefined>;
  /** A row's children: a key or a function (default "children"). @tr Bir satırın çocukları: anahtar ya da fonksiyon (varsayılan "children"). */
  childrenOf?: NodeField<D> | undefined;
  /** A leaf's value: a key or a function (default "value"); a group is the sum of its leaves. @tr Bir yaprağın değeri: anahtar ya da fonksiyon (varsayılan "value"); bir grup yapraklarının toplamıdır. */
  value?: NodeField<D> | undefined;
  /** A row's label: a key or a function (default `label`, then `name`). @tr Bir satırın etiketi: anahtar ya da fonksiyon (varsayılan `label`, sonra `name`). */
  label?: NodeField<D> | undefined;
  /** A row's stable id (default its path of labels): tiles keep their identity across data changes by it. @tr Bir satırın kalıcı kimliği (varsayılan etiket yolu): kutular veri değişince bununla tanınır. */
  id?: NodeField<D> | undefined;
  /** Levels drawn below the current root: 1 = flat tiles, 2 (default) = groups with a header and their tiles inside. @tr Geçerli kökün altında çizilen seviye sayısı: 1 = düz kutular, 2 (varsayılan) = başlıklı gruplar ve içlerindeki kutular. */
  depth?: Opt<number>;
  /** Color tiles by a number of their row (a key or getter) through `colorScale` instead of by branch. @tr Kutuları dal yerine satırdaki bir sayıya göre (anahtar ya da getter) `colorScale` ile renklendirir. */
  colorValue?: Field<D> | undefined;
  /** "sequential" (default), "diverging", or two / three colors or tokens. @tr "sequential" (varsayılan), "diverging" ya da iki / üç renk veya token. */
  colorScale?: Opt<ColorScale>;
  /** Middle value of a diverging scale (default halfway). @tr Ayrışan ölçeğin orta değeri (varsayılan ortası). */
  colorMid?: Opt<number>;
  /** The small color scale under the chart when `colorValue` is set (default true). @tr `colorValue` verilince grafiğin altındaki küçük renk ölçeği (varsayılan true). */
  colorLegend?: Opt<boolean>;
  /** Value format for labels, tooltip and table: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Etiket, araç ipucu ve tablo için değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Format of the color values in the color scale (default `format`). @tr Renk ölçeğindeki değerlerin biçimi (varsayılan `format`). */
  colorFormat?: Opt<FormatSpec>;
  /** Names on the tiles and group headers; hidden on a tile they do not fit (default true). @tr Kutularda ve grup başlıklarında adlar; sığmadığı kutuda gizlenir (varsayılan true). */
  labels?: Opt<boolean>;
  /** The formatted value under each name (default true). @tr Her adın altında biçimlenmiş değer (varsayılan true). */
  valueLabels?: Opt<boolean>;
  /** Gap between tiles in px (default 2). @tr Kutular arasındaki boşluk, px (varsayılan 2). */
  padding?: Opt<number>;
  /** Corner radius of the tiles in px (default 4). @tr Kutuların köşe yarıçapı, px (varsayılan 4). */
  radius?: Opt<number>;
  /** Height of a group's header in px (default 20). @tr Grup başlığının yüksekliği, px (varsayılan 20). */
  headerHeight?: Opt<number>;
  /** Click / Enter on a group zooms into it (default true). @tr Bir gruba tıklamak / Enter ona yakınlaşır (varsayılan true). */
  drill?: Opt<boolean>;
  /** The breadcrumb row over the chart while drilling is on (default true). @tr Yakınlaşma açıkken grafiğin üstündeki kırıntı satırı (varsayılan true). */
  breadcrumbs?: Opt<boolean>;
  /** Name of the top crumb (default "All", translated). @tr En üst kırıntının adı (varsayılan "All", çevrilir). */
  rootLabel?: Opt<string>;
  /** Key of the node shown as the root (drill from outside); the chart still drills by itself. @tr Kök olarak gösterilen düğümün anahtarı (dışarıdan yakınlaşma); grafik kendi de yakınlaşır. */
  focus?: Opt<string>;
  /** Called with the new root after a drill (null: back at the top). @tr Bir yakınlaşmadan sonra yeni kökle çağrılır (null: en üstte). */
  onDrill?: Handler<[p: TreemapPoint<D> | null]> | undefined;
  /** Header of the path column in the data table (default "Path"). @tr Veri tablosundaki yol sütununun başlığı (varsayılan "Path"). */
  xLabel?: Opt<string>;
  /** Header of the value column in the data table (default "Value"). @tr Veri tablosundaki değer sütununun başlığı (varsayılan "Value"). */
  yLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<TreemapPoint<D>>;
  /** Called with a leaf on click, or Enter / Space on the focused one (a group drills instead). @tr Bir yaprağa tıklanınca ya da odaktakinde Enter / Space'e basılınca çağrılır (grup ise yakınlaşır). */
  onSelect?: Handler<[p: TreemapPoint<D>]> | undefined;
  /** Change animation: `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or a function per tile. @tr Değişim animasyonu: `true` (varsayılan, yay), `false`, easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da kutu başına fonksiyon. */
  animate?: MaybeReactive<AnimateProp> | undefined;
}

type Kind = "root" | "group" | "leaf";
interface Tile<D> extends Rect { key: string; node: HNode<D>; kind: Kind; index: number; order: number; fill: string | null; drillable: boolean }

const shrink = <T extends Rect>(r: T): T => ({ ...r, x: r.x + r.w / 2, y: r.y + r.h / 2, w: 0, h: 0 });
const pathOf = (n: HNode<unknown>): string[] => { const out: string[] = []; for (let c: HNode<unknown> | null = n; c && c.parent; c = c.parent) out.unshift(c.label); return out; };
const find = <D>(n: HNode<D>, key: string): HNode<D> | null => {
  if (n.key === key) return n;
  for (const c of n.children) { const f = find(c, key); if (f) return f; }
  return null;
};

// keys from the path of labels below the root (hierarchy() prefixes the synthetic root's index), unique among siblings
const rekey = (n: HNode<unknown>): void => {
  const seen = new Set<string>();
  n.children.forEach((c, i) => {
    let k = (n.parent || n.key ? `${n.key}/` : "") + (c.label || String(i));
    if (seen.has(k)) k += `#${i}`;
    seen.add(k); c.key = k; rekey(c);
  });
};

/** Treemap: nested rectangles sized by value, with drill-in. See docs.md for props. */
export function Treemap<D>(props: TreemapProps<D>): Element {
  const size = useSize(props, 640, 320);
  const hidden = signal(new Set<string>()), active = signal(-1);
  const tip = tooltipState();
  const how = (): AnimateProp => animateOf(props.animate as AnimateProp);
  let svg: Element | null = null;

  const full = computed(() => {
    const p = props.data, d = typeof p === "function" ? (p as () => D | readonly D[] | null | undefined)() : p;
    const root = hierarchy<D>((d ?? []) as D | readonly D[], { children: props.childrenOf as never, value: props.value as never, label: props.label as never, key: props.id as never });
    if (props.id == null) rekey(root as HNode<unknown>);
    return root;
  });
  // the legend hides top-level branches: a shallow root without them
  const tree = computed((): HNode<D> => {
    const f = full(), off = hidden();
    if (!off.size) return f;
    const kids = f.children.filter((c) => !off.has(c.key));
    return { ...f, children: kids, value: kids.reduce((a, c) => a + c.value, 0) };
  });
  const focusKey = signal<string | null>(null);
  effect(() => { const k = read(props.focus); untrack(() => focusKey.set(k ?? null)); });
  const focus = computed((): HNode<D> => {
    const k = focusKey(), top = tree();
    const n = k == null ? null : find(top, k);
    return n && n.children.length ? n : top;
  });
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const colorOf = computed(() => {
    if (props.colorValue == null) return null;
    const get = accessor<D>(props.colorValue);
    const vals = descendants(full()).map((n, i) => num(get(n.datum, i))).filter((v): v is number => v != null);
    if (!vals.length) return null;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return { get, lo, hi, mid: num(read(props.colorMid)) ?? undefined, scale: colorScale(read(props.colorScale), lo, hi, num(read(props.colorMid)) ?? undefined) };
  });
  const pointOf = (n: HNode<D>): TreemapPoint<D> => ({ key: n.key, label: n.label, value: n.value, share: n.parent?.value ? n.value / n.parent.value : 1, depth: n.depth, path: pathOf(n as HNode<unknown>), leaf: !n.children.length, datum: n.datum, node: n });

  const tiles = computed((): Tile<D>[] => {
    const root = focus(), top = tree(), w = size.width(), hh = size.height();
    const levels = Math.max(1, Math.round(num(read(props.depth)) ?? 2));
    const pad = Math.max(0, num(read(props.padding)) ?? 2), head = Math.max(0, num(read(props.headerHeight)) ?? 20);
    const canDrill = read(props.drill) !== false, c = colorOf();
    const out: Tile<D>[] = [];
    const fill = (n: HNode<D>, i: number): string | null => (c ? c.scale(num(c.get(n.datum, i))) : null);
    if (root !== top) out.push({ key: root.key, node: root, kind: "root", index: 0, order: -1, x: 0, y: 0, w, h: hh, fill: null, drillable: false });
    const place = (n: HNode<D>, r: Rect, level: number): void => {
      const rs = squarify(n.children.map((k) => k.value), r);
      n.children.forEach((k, i) => {
        const q = rs[i]!, x = q.x + pad / 2, y = q.y + pad / 2, cw = q.w - pad, ch = q.h - pad;
        if (cw < 1 || ch < 1) return;
        const group = level < levels && k.children.length > 0 && cw > 2 * pad + 12 && ch > head + pad + 12;
        out.push({ key: k.key, node: k, kind: group ? "group" : "leaf", index: i, order: out.length, x, y, w: cw, h: ch, fill: group ? null : fill(k, i), drillable: canDrill && k.children.length > 0 });
        if (group) place(k, { x: x + pad, y: y + head, w: cw - 2 * pad, h: ch - head - pad }, level + 1);
      });
    };
    place(root, { x: 0, y: 0, w, h: hh }, 1);
    return out;
  });
  const nav = computed(() => tiles().filter((s) => s.kind !== "root"));
  const pres = presence(tiles, (s) => s.key, how);

  const drillTo = (n: HNode<D> | null): void => {
    if (read(props.drill) === false) return;
    const top = untrack(tree);
    const target = n && n.children.length ? n : top;
    if (target === untrack(focus)) return;
    focusKey.set(target === top ? null : target.key);
    active.set(-1); tip.at.set(null);
    props.onDrill?.(target === top ? null : pointOf(target));
  };
  const up = (): boolean => { const f = untrack(focus); if (!f.parent || f === untrack(tree)) return false; drillTo(f.parent.parent ? f.parent : null); return true; };

  const show = (k: number): void => {
    active.set(k);
    const opt = read(props.tooltip), s = nav()[k];
    if (!s || opt === false) return void tip.at.set(null);
    const p = pointOf(s.node);
    const content = typeof opt === "function" ? () => opt(p)
      : () => tipBody(p.path.join(" › "), [{ label: applyPipe("percent", p.share, 1), value: fmt()(p.value), index: s.node.branch }], props.colors);
    showTip(tip, svg, size.width(), s.x + s.w / 2, s.kind === "group" ? s.y + 10 : s.y + s.h / 2, content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const activate = (s: Tile<D> | undefined): void => {
    if (!s) return;
    if (s.kind === "root") return void up();
    if (s.drillable) return drillTo(s.node);
    props.onSelect?.(pointOf(s.node));
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return activate(nav()[active.peek()]); }
    if (e.key === "Escape" || e.key === "Backspace") {
      if (up()) return void e.preventDefault();
      if (e.key === "Escape") hide();
      return;
    }
    const k = navIndex(e.key, active.peek(), 0, nav().length - 1);
    if (k == null || !nav().length) return;
    e.preventDefault();
    show(k);
  };
  const activeKey = (): string | undefined => nav()[active()]?.key;

  const showLabels = (): boolean => read(props.labels) !== false;
  const showValues = (): boolean => read(props.valueLabels) !== false;
  const radius = (): number => Math.max(0, num(read(props.radius)) ?? 4);
  const head = (): number => Math.max(0, num(read(props.headerHeight)) ?? 20);

  const body = [
    h("g", { class: "m-chart-plot m-treemap-plot", onPointerLeave: hide },
      each<Tile<D> & { leaving?: boolean }>({ each: pres.items, key: (s) => s.key, children: (s) => {
        const key = untrack(s).key;
        const target = (): Tile<D> => { const v = s(); return v.leaving ? shrink(v) : v; };
        const a = tween(target, ["x", "y", "w", "h"], how, (to) => shrink(to), {
          index: () => Math.max(0, s().order), key, leaving: () => !!s().leaving,
          onSettle: () => { if (untrack(s).leaving) pres.done(key); },
        });
        const fits = (txt: string, minH: number): boolean => { const r = a(); return r.w >= textWidth(txt, 6.6) + 12 && r.h >= minH; };
        const label = (): string => s().node.label;
        const value = (): string => String(fmt()(s().node.value));
        const at = (): number => nav().findIndex((x) => x.key === key);
        return h("g", {
          class: () => {
            const v = s();
            return ["m-treemap-tile", `m-treemap-${v.kind}`, seriesClass(v.node.branch), `m-treemap-shade-${v.index % 3}`, v.fill && "m-treemap-scaled", v.drillable && "m-treemap-drillable", v.leaving && "m-treemap-leaving"].filter(Boolean).join(" ");
          },
          "class:m-chart-active": () => activeKey() === key,
          style: () => (s().fill ? { "--m-c": s().fill as string } : colorStyle(props.colors, s().node.branch)),
          transform: attr(() => { const r = a(); return `translate(${f1(r.x)},${f1(r.y)})`; }),
          onPointerEnter: () => { const k = at(); if (k >= 0) show(k); },
          onClick: (e: MouseEvent) => { e.stopPropagation(); activate(untrack(s)); },
        },
        h("rect", { width: attr(() => f1(Math.max(0, a().w))), height: attr(() => f1(Math.max(0, a().h))),
          rx: attr(() => { const r = a(); return f1(Math.min(radius(), Math.max(0, r.w) / 2, Math.max(0, r.h) / 2)); }) }),
        () => {
          if (!showLabels() || s().kind === "root") return null;
          if (s().kind === "group") {
            return h("text", { class: "m-treemap-header", x: 6, y: attr(() => f1(Math.min(head(), a().h) / 2)), "dominant-baseline": "middle" },
              () => { const l = label(), v = value(), both = `${l} · ${v}`; return showValues() && fits(both, head() * 0.8) ? both : fits(l, head() * 0.8) ? l : ""; });
          }
          return [
            h("text", { class: "m-treemap-label", x: 6, y: 15 }, () => (fits(label(), 20) ? label() : "")),
            h("text", { class: "m-treemap-value", x: 6, y: 29 }, () => (showValues() && fits(label(), 36) && fits(value(), 36) ? value() : "")),
          ];
        });
      } })),
  ];

  const crumbs = computed((): Crumb[] => {
    const list: HNode<D>[] = [];
    for (let n: HNode<D> | null = focus(); n; n = n.parent) list.unshift(n);
    return list.map((n, i) => ({ id: n.key || "m-root", label: i === 0 ? String(read(props.rootLabel) ?? t`All`) : n.label, onSelect: () => drillTo(i === 0 ? null : n) }));
  });
  const scaleBar = (): unknown => {
    const c = colorOf();
    if (!c || read(props.colorLegend) === false) return null;
    const f = formatter(read<FormatSpec | null | undefined>(props.colorFormat) ?? read<FormatSpec | null | undefined>(props.format));
    const mid = c.mid ?? (c.lo + c.hi) / 2;
    return h("div", { class: "m-treemap-scale", dir: "ltr", "aria-hidden": "true" },
      h("span", {}, String(f(c.lo))),
      h("span", { class: "m-treemap-scale-bar", style: { background: `linear-gradient(to right, ${c.scale(c.lo)}, ${c.scale(mid)}, ${c.scale(c.hi)})` } }),
      h("span", {}, String(f(c.hi))));
  };

  return Frame<HNode<D>>(props, {
    kind: "treemap", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => full().value <= 0, tip,
    legend: { items: () => (read(props.legend) ? full().children.map((n, i) => ({ key: n.key, label: n.label, index: i })) : []), hidden },
    extra: [
      () => (read(props.drill) !== false && read(props.breadcrumbs) !== false ? (() => { const B = crumbsComp(); return B ? h(B, { items: crumbs, class: "m-treemap-crumbs", label: () => t`Treemap path` }) : null; })() : null),
      scaleBar,
    ],
    table: {
      caption: () => read(props.title), rows: () => descendants(full()),
      columns: () => [{ label: read(props.xLabel) ?? t`Path`, value: (n: HNode<D>) => pathOf(n as HNode<unknown>).join(" › ") },
        { label: read(props.yLabel) ?? t`Value`, value: (n: HNode<D>) => fmt()(n.value) }],
    },
  });
}
