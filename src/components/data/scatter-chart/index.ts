// ScatterChart: points on two numeric (or time) axes (march/charts). Folder: src/components/data/scatter-chart/; shared
// chart parts (scales, axes, tooltip, data table, motion, reference marks) are in src/charts/.
// A `size` field makes it a bubble chart (area-scaled radius), `group` colors the points by series (legend toggles,
// one shape per series), `trend` fits a least-squares line per group. Points are a keyed presence list: they grow in,
// glide to new x / y / radius and shrink out when they leave. Hover picks the nearest point by distance (no voronoi).
import "./scatter-chart.css";
import { signal, computed, read, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { t } from "../../../core/i18n.ts";
import { scaleLinear, niceTicks, timeTicks } from "../../../charts/scale.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, xKind, timeMs, timeFormat, timeDetail, useSize, attr, textWidth, localPoint, navIndex, sameBox, each, f1,
  type MaybeReactive, type DataProp, type Field, type FormatSpec, type Formatter, type ChartBaseProps, type TooltipProp, type Box } from "../../../charts/util.ts";
import { tween, presence, animateOf, type AnimateProp, type Present } from "../../../charts/motion.ts";
import { Frame, Axis, Grid, tooltipState, showTip, tipBody, type Tick, type LegendItem } from "../../../charts/parts.ts";
import { RefMarks, statOf, type RefMarksProp, type RefStat } from "../../../charts/marks.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import type { Handler } from "../../../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** Point symbol of a series. */
export type PointShape = "circle" | "square" | "diamond" | "triangle";
/** Point passed to `tooltip(point)` and `onSelect(point)` of a scatter chart. */
export interface ScatterPoint<D> { index: number; key: string; datum: D; x: unknown; y: number; size: number | null; group: string | null; label: string | null }
/** A least-squares fit `y = slope × x + intercept` with its coefficient of determination. */
export interface LinearFit { slope: number; intercept: number; r2: number; n: number }

export interface ScatterChartProps<D = unknown> extends ChartBaseProps {
  /** Rows: an array (or signal / function returning one) of objects. @tr Satırlar: nesnelerden oluşan bir dizi (ya da onu döndüren sinyal / fonksiyon). */
  data?: DataProp<D>;
  /** The x value: a key or `(row, i) => value` (default "x"); numbers, or dates for a time axis. @tr x değeri: bir anahtar ya da `(row, i) => value` (varsayılan "x"); sayılar ya da zaman ekseni için tarihler. */
  x?: Field<D> | undefined;
  /** The y value: a key or getter (default "y"). @tr y değeri: bir anahtar ya da getter (varsayılan "y"). */
  y?: Field<D> | undefined;
  /** Bubble size: a key or getter; the point's area follows the value within `sizeRange`. @tr Kabarcık boyu: bir anahtar ya da getter; noktanın alanı `sizeRange` içinde değere göre büyür. */
  size?: Field<D> | undefined;
  /** Smallest and largest bubble radius in px (default [4, 26]). @tr En küçük ve en büyük kabarcık yarıçapı, px (varsayılan [4, 26]). */
  sizeRange?: Opt<readonly [number, number]>;
  /** Point radius in px without `size` (default 5). @tr `size` yokken nokta yarıçapı, px (varsayılan 5). */
  radius?: Opt<number>;
  /** Series of a point: a key or getter; each value is a colored series with a legend toggle. @tr Noktanın serisi: bir anahtar ya da getter; her değer gösterge düğmesi olan renkli bir seridir. */
  group?: Field<D> | undefined;
  /** Labels of the group values for legend, tooltip and table (`{ value: label }`). @tr Grup değerlerinin gösterge, araç ipucu ve tablo etiketleri (`{ value: label }`). */
  groupLabels?: Opt<Readonly<Record<string, string>>>;
  /** Point name for the tooltip and the table: a key or getter. @tr Araç ipucu ve tablo için nokta adı: bir anahtar ya da getter. */
  label?: Field<D> | undefined;
  /** Identity of a point across data changes, so it glides (default the label, else the row index). @tr Veri değişince noktanın kimliği, kayarak gitsin diye (varsayılan etiket, yoksa satır sırası). */
  key?: Field<D> | undefined;
  /** Symbol: one for all, a list by group, or "auto" (circle, square, diamond, triangle in turn). @tr Simge: hepsi için bir tane, gruba göre bir liste ya da "auto" (sırayla daire, kare, karo, üçgen). */
  shape?: Opt<PointShape | "auto" | readonly PointShape[]>;
  /** Forces the x scale: "linear" or "time" (default detected from the data). @tr x ölçeğini zorlar: "linear" ya da "time" (varsayılan veriden anlaşılır). */
  xType?: Opt<"linear" | "time">;
  /** Format of the x values: a pipe name, `[pipe, ...args]` or a function. @tr x değerlerinin biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon. */
  xFormat?: Opt<FormatSpec>;
  /** Format of the y values (default "number"). @tr y değerlerinin biçimi (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Format of the size values (default "number"). @tr Boy değerlerinin biçimi (varsayılan "number"). */
  sizeFormat?: Opt<FormatSpec>;
  /** Fixes the low end of the x axis. @tr x ekseninin alt ucunu sabitler. */
  xMin?: Opt<number>;
  /** Fixes the high end of the x axis. @tr x ekseninin üst ucunu sabitler. */
  xMax?: Opt<number>;
  /** Fixes the low end of the y axis. @tr y ekseninin alt ucunu sabitler. */
  yMin?: Opt<number>;
  /** Fixes the high end of the y axis. @tr y ekseninin üst ucunu sabitler. */
  yMax?: Opt<number>;
  /** Grid lines: `true` (default, both ways), `false`, "x" or "y". @tr Izgara çizgileri: `true` (varsayılan, iki yönde), `false`, "x" ya da "y". */
  grid?: Opt<boolean | "x" | "y" | "both">;
  /** Title under the x axis. @tr x ekseninin altındaki başlık. */
  xTitle?: Opt<string>;
  /** Title beside the y axis. @tr y ekseninin yanındaki başlık. */
  yTitle?: Opt<string>;
  /** A least-squares trend line per group: "linear" or `true`. @tr Grup başına en küçük kareler eğilim çizgisi: "linear" ya da `true`. */
  trend?: Opt<"linear" | boolean>;
  /** Text at the end of a trend line: `true` (default, r²), `false`, or `(fit) => text`. @tr Eğilim çizgisinin ucundaki yazı: `true` (varsayılan, r²), `false` ya da `(fit) => text`. */
  trendLabel?: Opt<boolean | ((fit: LinearFit) => string)>;
  /** Reference lines, bands and annotations (quadrant lines, targets, averages). @tr Referans çizgileri, bantları ve notları (çeyrek çizgileri, hedefler, ortalamalar). */
  marks?: RefMarksProp;
  /** Header of the x column in the data table and the tooltip (default the x key). @tr Veri tablosu ve araç ipucundaki x başlığı (varsayılan x anahtarı). */
  xLabel?: Opt<string>;
  /** Header of the y column in the data table and the tooltip (default the y key). @tr Veri tablosu ve araç ipucundaki y başlığı (varsayılan y anahtarı). */
  yLabel?: Opt<string>;
  /** Header of the size column in the data table and the tooltip (default the size key). @tr Veri tablosu ve araç ipucundaki boy başlığı (varsayılan boy anahtarı). */
  sizeLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<ScatterPoint<D>>;
  /** Called with the point on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki öğede Enter / Space'e basılınca noktayla çağrılır. */
  onSelect?: Handler<[p: ScatterPoint<D>]> | undefined;
  /** Change animation: points grow in, glide to new places and sizes, leave by shrinking. `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or a function per point. @tr Değişim animasyonu: noktalar büyüyerek girer, yeni yer ve boylarına kayar, küçülerek çıkar. `true` (varsayılan, yay), `false`, bir easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da nokta başına bir fonksiyon. */
  animate?: MaybeReactive<AnimateProp> | undefined;
}

interface Item<D> { key: string; index: number; datum: D; xr: unknown; x: number; y: number; s: number | null; gk: string; label: string | null }
interface Pt { key: string; index: number; gi: number; gk: string; x: number; y: number; r: number; rank: number; shape: PointShape }
interface Trend { key: string; gi: number; x1: number; y1: number; x2: number; y2: number; fit: LinearFit }

const SHAPES: readonly PointShape[] = ["circle", "square", "diamond", "triangle"];
const f2 = (v: number): number => Math.round(v * 100) / 100;

/** SVG path of a point symbol centred on 0,0 whose area matches a circle of radius `r`. */
export function symbolPath(shape: PointShape, r: number): string {
  if (!(r > 0)) return "";
  if (shape === "square") { const s = f2(r * 0.8862); return `M${-s},${-s}H${s}V${s}H${-s}Z`; }
  if (shape === "diamond") { const d = f2(r * 1.2533); return `M0,${-d}L${d},0L0,${d}L${-d},0Z`; }
  if (shape === "triangle") { const a = r * 2.6935, hh = a * 0.866; return `M0,${f2((-2 * hh) / 3)}L${f2(a / 2)},${f2(hh / 3)}L${f2(-a / 2)},${f2(hh / 3)}Z`; }
  const q = f2(r);
  return `M${-q},0a${q},${q} 0 1,0 ${f2(2 * r)},0a${q},${q} 0 1,0 ${f2(-2 * r)},0Z`;
}

/** Least-squares line through `[x, y]` pairs (null for fewer than two points or no x spread). */
export function linearFit(pts: readonly (readonly [number, number])[]): LinearFit | null {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  const mx = sx / n, my = sy / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of pts) { const dx = x - mx, dy = y - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  if (!sxx) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy ? (sxy * sxy) / (sxx * syy) : 1, n };
}

/** Scatter / bubble chart. */
export function ScatterChart<D>(props: ScatterChartProps<D>): Element {
  const size = useSize(props, 640, 300);
  const hidden = signal(new Set<string>()), active = signal<string | null>(null);
  const tip = tooltipState();
  const how = (): AnimateProp => animateOf(props.animate as AnimateProp | (() => AnimateProp));
  let svg: Element | null = null;

  const rows = computed(() => rowsOf(props.data));
  const xType = computed((): "linear" | "time" => {
    const f = read(props.xType);
    if (f) return f;
    const g = accessor<D>(props.x ?? "x");
    return xKind(rows().slice(0, 20).map((d, i) => g(d, i))) === "time" ? "time" : "linear";
  });
  const items = computed((): Item<D>[] => {
    const gx = accessor<D>(props.x ?? "x"), gy = accessor<D>(props.y ?? "y"), time = xType() === "time";
    const gs = props.size != null ? accessor<D>(props.size) : null, gg = props.group != null ? accessor<D>(props.group) : null;
    const gl = props.label != null ? accessor<D>(props.label) : null, gkey = props.key != null ? accessor<D>(props.key) : null;
    const seen = new Map<string, number>(), out: Item<D>[] = [];
    rows().forEach((d, i) => {
      const xr = gx(d, i), x = time ? timeMs(xr) : num(xr), y = num(gy(d, i));
      if (x == null || y == null || !isFinite(x)) return;
      const label = gl ? String(gl(d, i) ?? "") : null;
      let key = gkey ? String(gkey(d, i)) : label || String(i);
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      if (n) key += `#${n}`;
      out.push({ key, index: i, datum: d, xr, x, y, s: gs ? num(gs(d, i)) : null, gk: gg ? String(gg(d, i) ?? "") : "", label });
    });
    return out;
  });
  const groups = computed((): LegendItem[] => {
    const labels = read(props.groupLabels) ?? {}, seen: LegendItem[] = [], has = new Set<string>();
    for (const it of items()) if (!has.has(it.gk)) { has.add(it.gk); seen.push({ key: it.gk, label: labels[it.gk] ?? it.gk, index: seen.length }); }
    return seen;
  });
  const groupIndex = computed(() => new Map(groups().map((g) => [g.key, g.index])));
  const visible = computed(() => { const hd = hidden(); return items().filter((it) => !hd.has(it.gk)); });

  const xFmt = computed((): Formatter => {
    const f = read<FormatSpec | null | undefined>(props.xFormat);
    if (f != null) return formatter(f);
    if (xType() === "time") { const [lo, hi] = xExtent(); return timeDetail(hi - lo); }
    return (v) => applyPipe("number", v);
  });
  const xTickFmt = computed((): Formatter => {
    const f = read<FormatSpec | null | undefined>(props.xFormat);
    if (f != null) return formatter(f);
    if (xType() === "time") { const [lo, hi] = xExtent(); return timeFormat(hi - lo); }
    return (v) => applyPipe("number", v);
  });
  const yFmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const sFmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.sizeFormat)));

  const extent = (pick: (it: Item<D>) => number): [number, number] => {
    let lo = Infinity, hi = -Infinity;
    for (const it of visible()) { const v = pick(it); if (v < lo) lo = v; if (v > hi) hi = v; }
    return isFinite(lo) ? [lo, hi] : [0, 1];
  };
  const xExtent = computed(() => extent((it) => it.x), { equals: (a, b) => !!a && a[0] === b[0] && a[1] === b[1] });
  const yNice = computed(() => {
    const [lo, hi] = extent((it) => it.y);
    return niceTicks(num(read(props.yMin)) ?? lo, num(read(props.yMax)) ?? hi, Math.max(2, Math.floor((size.height() - 40) / 44)));
  });
  const xTitle = computed(() => read(props.xTitle) ?? ""), yTitle = computed(() => read(props.yTitle) ?? "");
  const box = computed((): Box => {
    const f = yFmt(), ml = Math.min(120, Math.max(32, 12 + Math.max(0, ...yNice().ticks.map((v) => textWidth(f(v)))))) + (yTitle() ? 20 : 0);
    const mb = 28 + (xTitle() ? 18 : 0), mt = 14;
    return { x: ml, y: mt, w: Math.max(10, size.width() - ml - 18), h: Math.max(10, size.height() - mt - mb) };
  }, { equals: sameBox });
  const xDomain = computed((): { min: number; max: number; ticks: number[] } => {
    const [lo, hi] = xExtent(), b = box(), n = Math.max(2, Math.floor(b.w / 90));
    const a = num(read(props.xMin)) ?? lo, z = num(read(props.xMax)) ?? hi;
    if (xType() === "time") { const pad = (z - a) * 0.03 || 864e5; return { min: a - pad, max: z + pad, ticks: timeTicks(a - pad, z + pad, n) }; }
    return niceTicks(a, z, n);
  });
  const xs = computed(() => scaleLinear([xDomain().min, xDomain().max], [0, box().w]));
  const ys = computed(() => scaleLinear([yNice().min, yNice().max], [box().h, 0]));
  const xTicks = computed((): Tick[] => { const s = xs(), f = xTickFmt(); return xDomain().ticks.map((v) => ({ key: v, pos: f1(s(v)), label: f(v) })); });
  const yTicks = computed((): Tick[] => { const s = ys(), f = yFmt(); return yNice().ticks.map((v) => ({ key: v, pos: f1(s(v)), label: f(v) })); });

  const shapeOf = (gi: number): PointShape => {
    const s = read(props.shape);
    if (Array.isArray(s)) return (s as readonly PointShape[])[gi % Math.max(1, s.length)] ?? "circle";
    if (s === "auto") return SHAPES[gi % SHAPES.length] as PointShape;
    return (s as PointShape | null | undefined) ?? "circle";
  };
  const points = computed((): Pt[] => {
    const vis = visible(), sx = xs(), sy = ys(), gi = groupIndex();
    const [r0, r1] = read(props.sizeRange) ?? [4, 26], rr = num(read(props.radius)) ?? 5;
    let slo = Infinity, shi = -Infinity;
    for (const it of vis) if (it.s != null) { slo = Math.min(slo, it.s); shi = Math.max(shi, it.s); }
    const radius = (s: number | null): number => {
      if (props.size == null) return rr;
      if (s == null) return r0;
      if (!(shi > slo)) return (r0 + r1) / 2;
      return Math.sqrt(r0 * r0 + (r1 * r1 - r0 * r0) * ((s - slo) / (shi - slo)));
    };
    const pts = vis.map((it): Pt => { const g = gi.get(it.gk) ?? 0; return { key: it.key, index: it.index, gi: g, gk: it.gk, x: sx(it.x), y: sy(it.y), r: radius(it.s), rank: 0, shape: shapeOf(g) }; });
    // rank: the order along x (keyboard order and the entrance sweep); bigger bubbles drawn first so small ones stay on top
    pts.slice().sort((a, b) => a.x - b.x || b.y - a.y).forEach((p, i) => { p.rank = i; });
    return props.size != null ? pts.sort((a, b) => b.r - a.r) : pts;
  });
  const order = computed(() => { const o: string[] = []; for (const p of points()) o[p.rank] = p.key; return o; });
  const byKey = computed(() => new Map(items().map((it) => [it.key, it])));
  const ptByKey = computed(() => new Map(points().map((p) => [p.key, p])));

  const trends = computed((): Trend[] => {
    const tr = read(props.trend);
    if (!tr) return [];
    const by = new Map<string, Item<D>[]>();
    for (const it of visible()) { const l = by.get(it.gk); l ? l.push(it) : by.set(it.gk, [it]); }
    const out: Trend[] = [], sx = xs(), sy = ys(), gi = groupIndex();
    for (const [gk, list] of by) {
      const fit = linearFit(list.map((it) => [it.x, it.y] as const));
      if (!fit) continue;
      let a = Infinity, b = -Infinity;
      for (const it of list) { a = Math.min(a, it.x); b = Math.max(b, it.x); }
      out.push({ key: gk, gi: gi.get(gk) ?? 0, x1: sx(a), y1: sy(fit.slope * a + fit.intercept), x2: sx(b), y2: sy(fit.slope * b + fit.intercept), fit });
    }
    return out;
  });
  const trendText = (fit: LinearFit): string => {
    const l = read<boolean | ((fit: LinearFit) => string) | null | undefined>(props.trendLabel);
    if (l === false) return "";
    if (typeof l === "function") return l(fit);
    return `r² ${applyPipe("number", Math.round(fit.r2 * 100) / 100)}`;
  };

  // ---- interaction
  const pointOf = (key: string): ScatterPoint<D> | undefined => {
    const it = byKey().get(key);
    if (!it) return undefined;
    return { index: it.index, key, datum: it.datum, x: it.xr, y: it.y, size: it.s, group: props.group != null ? it.gk : null, label: it.label };
  };
  const headX = (): string => read(props.xLabel) ?? (typeof props.x === "string" ? props.x : "x");
  const headY = (): string => read(props.yLabel) ?? (typeof props.y === "string" ? props.y : "y");
  const headS = (): string => read(props.sizeLabel) ?? (typeof props.size === "string" ? props.size : t`Size`);
  const groupLabel = (gk: string): string => String(groups().find((g) => g.key === gk)?.label ?? gk);
  const show = (key: string | null): void => {
    active.set(key);
    const opt = read(props.tooltip), p = key == null ? undefined : ptByKey().get(key), pt = key == null ? undefined : pointOf(key);
    if (!p || !pt || opt === false) return void tip.at.set(null);
    const b = box();
    const content = typeof opt === "function" ? () => opt(pt) : () => {
      const rows = [{ label: headX(), value: xFmt()(pt.x), index: p.gi }, { label: headY(), value: yFmt()(pt.y), index: p.gi }];
      if (props.size != null) rows.push({ label: headS(), value: sFmt()(pt.size), index: p.gi });
      return tipBody(pt.label ?? (pt.group != null ? groupLabel(pt.group) : ""), rows, props.colors);
    };
    showTip(tip, svg, size.width(), b.x + p.x, b.y + p.y, content);
  };
  const hide = (): void => show(null);
  const select = (key = active.peek()): void => { const p = key == null ? undefined : pointOf(key); if (p) props.onSelect?.(p); };
  const nearest = (e: PointerEvent): string | null => {
    const [px, py] = localPoint(svg, e, size.width()), b = box(), x = px - b.x, y = py - b.y;
    let best: string | null = null, bd = Infinity;
    for (const p of points()) { const d = (p.x - x) ** 2 + (p.y - y) ** 2 - p.r * p.r; if (d < bd) { bd = d; best = p.key; } }
    return best;
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const o = order(), a = active.peek(), i = navIndex(e.key, a == null ? -1 : o.indexOf(a), 0, o.length - 1);
    if (i == null || !o.length) return;
    e.preventDefault();
    show(o[i] ?? null);
  };

  const present = presence(points, (p) => p.key, how);
  const pr = presence(trends, (p) => p.key, how);
  const focus = computed(() => { const k = active(); return k == null ? undefined : ptByKey().get(k); });
  const gridOn = (dir: "x" | "y"): boolean => { const g = read(props.grid) ?? true; return g === true || g === "both" || g === dir; };
  const marks = {
    box,
    x: (v: unknown): number | null => { const n = xType() === "time" ? timeMs(v) : num(v); return n == null || !isFinite(n) ? null : xs()(n); },
    y: (v: number): number | null => ys()(v),
    stat: (s: RefStat, series: string | undefined): number | null => statOf(visible().filter((it) => series == null || it.gk === series).map((it) => it.y), s),
    fmtX: (v: unknown): unknown => xFmt()(xType() === "time" ? v : num(v)),
    fmtY: (v: unknown): unknown => yFmt()(v),
  };

  const body = [
    Grid({ dir: "h", ticks: () => (gridOn("y") ? yTicks() : []), box }),
    Grid({ dir: "v", ticks: () => (gridOn("x") ? xTicks() : []), box }),
    Axis({ side: "left", ticks: yTicks, box }),
    Axis({ side: "bottom", ticks: xTicks, box }),
    h("text", { class: "m-chart-axis-title m-scatter-x-title", "text-anchor": "middle", x: attr(() => f1(box().x + box().w / 2)), y: attr(() => f1(box().y + box().h + 40)) }, xTitle),
    h("text", { class: "m-chart-axis-title m-scatter-y-title", "text-anchor": "middle", transform: attr(() => `translate(14,${f1(box().y + box().h / 2)}) rotate(-90)`) }, yTitle),
    RefMarks({ marks: props.marks, scales: marks, layer: "back" }),
    h("g", { class: () => `m-chart-plot m-scatter-plot${active() != null ? " m-scatter-hovering" : ""}`, transform: attr(() => `translate(${box().x},${box().y})`),
      onPointerMove: (e: PointerEvent) => { const k = nearest(e); if (k !== active.peek()) show(k); }, onPointerLeave: hide, onClick: () => select() },
    h("rect", { class: "m-scatter-surface", x: 0, y: 0, width: attr(() => box().w), height: attr(() => box().h) }),
    h("g", { class: "m-scatter-trends" }, each<Present<Trend>>({ each: pr.items, key: (tr) => tr.key, children: (tr) => {
      const k = untrack(tr).key;
      const g = tween(() => { const q = tr(); return q.leaving ? { ...q, x2: q.x1, y2: q.y1 } : q; }, ["x1", "y1", "x2", "y2"], how, (to) => ({ ...to, x2: to.x1, y2: to.y1 }),
        { key: `trend:${k}`, leaving: () => !!tr().leaving, onSettle: () => { if (tr().leaving) pr.done(k); } });
      return h("g", { class: () => `m-scatter-trend ${seriesClass(tr().gi)}`, style: () => colorStyle(props.colors, tr().gi) },
        h("line", { x1: attr(() => f1(g().x1)), y1: attr(() => f1(g().y1)), x2: attr(() => f1(g().x2)), y2: attr(() => f1(g().y2)) }),
        h("text", { x: attr(() => f1(g().x2)), y: attr(() => f1(g().y2 - 8)), "text-anchor": "end" }, () => (tr().leaving ? "" : trendText(tr().fit))));
    } })),
    h("g", { class: "m-scatter-points" }, each<Present<Pt>>({ each: present.items, key: (p) => p.key, children: (p) => {
      const k = untrack(p).key;
      const g = tween(() => { const q = p(); return q.leaving ? { ...q, r: 0 } : q; }, ["x", "y", "r"], how, (to) => ({ ...to, r: 0 }),
        { index: () => p().rank, key: k, leaving: () => !!p().leaving, onSettle: () => { if (p().leaving) present.done(k); } });
      return h("path", {
        class: () => `m-scatter-point m-scatter-${p().shape} ${seriesClass(p().gi)}${props.size != null ? " m-scatter-bubble" : ""}`,
        "class:m-chart-active": () => active() === k, "class:m-scatter-leaving": () => !!p().leaving,
        style: () => colorStyle(props.colors, p().gi), "data-key": k,
        d: attr(() => symbolPath(p().shape, g().r)), transform: attr(() => `translate(${f1(g().x)},${f1(g().y)})`),
        onPointerEnter: () => { if (!p().leaving && active.peek() !== k) show(k); },
        onClick: (e: Event) => { e.stopPropagation(); if (!p().leaving) { show(k); select(k); } },
      });
    } })),
    h("g", { class: () => `m-scatter-focus ${seriesClass(focus()?.gi ?? 0)}`, style: () => colorStyle(props.colors, focus()?.gi ?? 0), visibility: () => (focus() ? "visible" : "hidden"), "aria-hidden": "true" },
      h("line", { class: "m-scatter-guide", x1: attr(() => f1(focus()?.x ?? 0)), x2: attr(() => f1(focus()?.x ?? 0)), y1: attr(() => f1((focus()?.y ?? 0) + (focus()?.r ?? 0) + 3)), y2: attr(() => box().h) }),
      h("line", { class: "m-scatter-guide", y1: attr(() => f1(focus()?.y ?? 0)), y2: attr(() => f1(focus()?.y ?? 0)), x1: 0, x2: attr(() => f1((focus()?.x ?? 0) - (focus()?.r ?? 0) - 3)) }),
      h("path", { class: "m-scatter-ring", transform: attr(() => `translate(${f1(focus()?.x ?? 0)},${f1(focus()?.y ?? 0)})`), d: attr(() => { const f = focus(); return f ? symbolPath(f.shape, f.r + 4) : ""; }) }))),
    RefMarks({ marks: props.marks, scales: marks, layer: "front" }),
  ];

  return Frame<Item<D>>(props, {
    kind: "scatter", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => items().length === 0, tip,
    legend: { items: () => { const l = read(props.legend); return props.group == null || l === false || (l == null && groups().length < 2) ? [] : groups(); }, hidden },
    table: {
      caption: () => read(props.title), rows: items,
      columns: () => [
        ...(props.label != null ? [{ label: t`Name`, value: (it: Item<D>) => it.label }] : []),
        ...(props.group != null ? [{ label: t`Group`, value: (it: Item<D>) => groupLabel(it.gk) }] : []),
        { label: headX(), value: (it: Item<D>) => untrack(xFmt)(it.xr) },
        { label: headY(), value: (it: Item<D>) => untrack(yFmt)(it.y) },
        ...(props.size != null ? [{ label: headS(), value: (it: Item<D>) => untrack(sFmt)(it.s) }] : []),
      ],
    },
  });
}
