// Histogram: raw values in, bins out (march/charts). Folder: src/components/data/histogram/; shared chart parts (scales,
// axes, tooltip, data table, motion, reference marks) are in src/charts/; distribution statistics in src/charts/stats.ts.
// Bins sit on nice thresholds (niceTicks) or a fixed `binWidth`; bars touch on a linear x axis. Groups overlay with
// transparency and share the thresholds. Bars are keyed by group and bin number, so a re-bin morphs each bar's x,
// width and height; extra bins grow from the baseline and removed ones shrink back to it.
import "./histogram.css";
import { signal, computed, read, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { scaleLinear, niceTicks, niceStep } from "../../../charts/scale.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, useSize, attr, textWidth, localPoint, navIndex, sameBox, each, f1,
  type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp, type Box } from "../../../charts/util.ts";
import { tween, presence, animateOf, type AnimateProp, type Present } from "../../../charts/motion.ts";
import { Frame, Axis, Grid, tooltipState, showTip, tipBody, type Tick, type LegendItem } from "../../../charts/parts.ts";
import { RefMarks, statOf, type RefMark, type RefMarksProp, type RefStat } from "../../../charts/marks.ts";
import { linePath } from "../../../charts/curve.ts";
import { mean, deviation, normalPdf, normalCdf, kde, silverman, samples } from "../../../charts/stats.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import type { Handler } from "../../../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** One bin: `[x0, x1)` (the last one includes x1). */
export interface Bin { index: number; x0: number; x1: number }
/** Point passed to `tooltip(point)` and `onSelect(point)` of a histogram. */
export interface HistogramPoint { index: number; x0: number; x1: number; label: string; counts: Record<string, number>; values: Record<string, number>; group: string | null; count: number; value: number }

export interface HistogramProps<D = unknown> extends ChartBaseProps {
  /** Raw values: numbers, or rows (array, signal or function returning one) read with `value`. @tr Ham değerler: sayılar ya da `value` ile okunan satırlar (dizi, sinyal ya da onu döndüren fonksiyon). */
  data?: DataProp<D>;
  /** The value of a row: a key or getter (default: the row itself when it is a number, else "value"). @tr Bir satırın değeri: bir anahtar ya da getter (varsayılan: sayıysa satırın kendisi, değilse "value"). */
  value?: Field<D> | undefined;
  /** Group of a row: a key or getter; groups overlay with transparency and toggle from the legend. @tr Satırın grubu: bir anahtar ya da getter; gruplar saydam üst üste biner, göstergeden açılıp kapanır. */
  group?: Field<D> | undefined;
  /** Labels of the group values for legend, tooltip and table (`{ value: label }`). @tr Grup değerlerinin gösterge, araç ipucu ve tablo etiketleri (`{ value: label }`). */
  groupLabels?: Opt<Readonly<Record<string, string>>>;
  /** About how many bins (rounded to nice thresholds; default Sturges' rule). @tr Yaklaşık kaç kutu (düzgün eşiklere yuvarlanır; varsayılan Sturges kuralı). */
  bins?: Opt<number>;
  /** Exact bin width (wins over `bins`). @tr Kesin kutu genişliği (`bins`'i geçersiz kılar). */
  binWidth?: Opt<number>;
  /** Fixes the binned range `[min, max]` (values outside are left out). @tr Kutulanan aralığı sabitler `[min, max]` (dışındaki değerler sayılmaz). */
  domain?: Opt<readonly [number, number]>;
  /** Running totals: each bar counts everything up to its upper edge. @tr Birikimli toplam: her çubuk üst kenarına kadar olan her şeyi sayar. */
  cumulative?: Opt<boolean>;
  /** Normalize: bar areas sum to 1 (with `cumulative`: shares from 0 to 1). @tr Normalleştir: çubuk alanlarının toplamı 1 (`cumulative` ile: 0'dan 1'e paylar). */
  density?: Opt<boolean>;
  /** A smooth curve over the bars: "normal" (fitted bell curve), "kde" (kernel density) or `false`. @tr Çubukların üstünde düzgün eğri: "normal" (uydurulmuş çan eğrisi), "kde" (çekirdek yoğunluğu) ya da `false`. */
  curve?: Opt<"normal" | "kde" | boolean>;
  /** Kernel bandwidth of the "kde" curve in x units (default Silverman's rule). @tr "kde" eğrisinin çekirdek genişliği, x biriminde (varsayılan Silverman kuralı). */
  bandwidth?: Opt<number>;
  /** Reference marks; `x: "average"` / `"median"` draw a group's mean / median line. @tr Referans işaretleri; `x: "average"` / `"median"` bir grubun ortalama / ortanca çizgisini çizer. */
  marks?: RefMarksProp;
  /** Format of the x values (bin edges; default "number"). @tr x değerlerinin biçimi (kutu kenarları; varsayılan "number"). */
  xFormat?: Opt<FormatSpec>;
  /** Format of the bar heights (counts, densities; default "number"). @tr Çubuk yüksekliklerinin biçimi (sayılar, yoğunluklar; varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Fixes the top of the value axis. @tr Değer ekseninin üst ucunu sabitler. */
  yMax?: Opt<number>;
  /** Horizontal grid lines (default true). @tr Yatay ızgara çizgileri (varsayılan true). */
  grid?: Opt<boolean>;
  /** Gap between bars in px (default 1). @tr Çubuklar arası boşluk, px (varsayılan 1). */
  gap?: Opt<number>;
  /** Title under the x axis. @tr x ekseninin altındaki başlık. */
  xTitle?: Opt<string>;
  /** Title beside the value axis. @tr Değer ekseninin yanındaki başlık. */
  yTitle?: Opt<string>;
  /** Header of the range column in the data table (default "Range"). @tr Veri tablosundaki aralık sütununun başlığı (varsayılan "Range"). */
  xLabel?: Opt<string>;
  /** Header of the value column with one group (default "Count", "Density" or "Share"). @tr Tek grupta değer sütununun başlığı (varsayılan "Count", "Density" ya da "Share"). */
  yLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<HistogramPoint>;
  /** Called with the bin on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki kutuda Enter / Space'e basılınca kutuyla çağrılır. */
  onSelect?: Handler<[p: HistogramPoint]> | undefined;
  /** Change animation: bars grow from the baseline, morph on a re-bin, removed bins shrink; the curve rises and morphs. `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or a function per bar. @tr Değişim animasyonu: çubuklar tabandan büyür, yeniden kutulamada biçim değiştirir, kalkan kutular küçülür; eğri yükselir ve biçim değiştirir. `true` (varsayılan, yay), `false`, bir easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da çubuk başına bir fonksiyon. */
  animate?: MaybeReactive<AnimateProp> | undefined;
}

interface Group { key: string; index: number; values: number[] }
interface Bar { key: string; i: number; gi: number; x: number; y: number; w: number; h: number }
interface Curve { key: string; gi: number; xs: number[]; ys: number[]; base: number }

const K = 96;
const STATS = new Set(["average", "median", "min", "max"]);

/** Thresholds for `values`: `binWidth`, or about `count` bins on nice values. */
export function binsOf(values: readonly number[], { count, width, domain }: { count?: number | null; width?: number | null; domain?: readonly [number, number] | null } = {}): Bin[] {
  let lo = domain?.[0] ?? Infinity, hi = domain?.[1] ?? -Infinity;
  if (!domain) for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!isFinite(lo) || !isFinite(hi)) return [];
  let start: number, end: number, step: number;
  if (width && width > 0) {
    // an explicit domain starts the first bin at its low end; otherwise bins sit on multiples of the width
    step = width; start = domain ? lo : Math.floor(lo / step) * step; end = start + Math.ceil((hi - start) / step - 1e-9) * step;
  } else {
    const n = count && count > 0 ? count : Math.ceil(Math.log2(Math.max(1, values.length)) + 1);
    if (lo === hi) { step = niceStep(Math.abs(lo) || 1, 4); start = Math.floor(lo / step) * step; end = start + step; } else {
      const nt = niceTicks(lo, hi, n);
      start = nt.min; end = nt.max; step = nt.step;
    }
  }
  if (end <= start) end = start + step;
  const nb = Math.min(500, Math.max(1, Math.round((end - start) / step)));
  const round = (v: number): number => Number(v.toPrecision(12));
  return Array.from({ length: nb }, (_, i) => ({ index: i, x0: round(start + i * step), x1: round(start + (i + 1) * step) }));
}

/** How many of `values` fall in each bin (`[x0, x1)`; the last bin includes its upper edge). */
export function countBins(values: readonly number[], bins: readonly Bin[]): number[] {
  const out = bins.map(() => 0), n = bins.length;
  if (!n) return out;
  const start = (bins[0] as Bin).x0, end = (bins[n - 1] as Bin).x1, step = (end - start) / n;
  for (const v of values) {
    if (v < start || v > end) continue;
    const i = v === end ? n - 1 : Math.min(n - 1, Math.floor((v - start) / step));
    out[i]! += 1;
  }
  return out;
}

/** Histogram. */
export function Histogram<D>(props: HistogramProps<D>): Element {
  const size = useSize(props, 640, 260);
  const hidden = signal(new Set<string>()), active = signal(-1);
  const tip = tooltipState();
  const how = (): AnimateProp => animateOf(props.animate as AnimateProp | (() => AnimateProp));
  let svg: Element | null = null;

  const rows = computed(() => rowsOf(props.data));
  const groups = computed((): Group[] => {
    const gv = accessor<D>(props.value, (d) => (typeof d === "number" || typeof d === "string" ? d : (d as Record<string, unknown> | null)?.value));
    const gg = props.group != null ? accessor<D>(props.group) : null, by = new Map<string, Group>();
    rows().forEach((d, i) => {
      const v = num(gv(d, i));
      if (v == null || !isFinite(v)) return;
      const k = gg ? String(gg(d, i) ?? "") : "";
      let g = by.get(k);
      if (!g) by.set(k, (g = { key: k, index: by.size, values: [] }));
      g.values.push(v);
    });
    return [...by.values()];
  });
  const legendItems = computed((): LegendItem[] => { const l = read(props.groupLabels) ?? {}; return groups().map((g) => ({ key: g.key, label: l[g.key] ?? g.key, index: g.index })); });
  const visible = computed(() => groups().filter((g) => !hidden().has(g.key)));
  const cumulative = computed(() => !!read(props.cumulative)), density = computed(() => !!read(props.density));

  // thresholds from every group (toggling a group keeps the bins where they are)
  const bins = computed(() => binsOf(groups().flatMap((g) => g.values), { count: num(read(props.bins)), width: num(read(props.binWidth)), domain: read(props.domain) ?? null }));
  const step = computed(() => { const b = bins(); return b.length ? (b[0] as Bin).x1 - (b[0] as Bin).x0 : 1; });
  /** Bar heights per group key (counts, or densities / running totals). */
  const heights = computed(() => {
    const out = new Map<string, { counts: number[]; ys: number[] }>(), b = bins(), w = step();
    for (const g of groups()) {
      const counts = countBins(g.values, b), n = g.values.length || 1;
      let run = 0;
      const ys = counts.map((c) => { run += c; const v = cumulative() ? run : c; return density() ? (cumulative() ? v / n : v / (n * w)) : v; });
      out.set(g.key, { counts, ys });
    }
    return out;
  });

  const curveKind = computed(() => { const c = read(props.curve); return c === true ? "kde" : c || null; });
  /** Curve samples per visible group in data units: [x values, y values]. */
  const curveData = computed(() => {
    const kind = curveKind(), b = bins();
    if (!kind || !b.length) return new Map<string, number[]>();
    const xsD = samples((b[0] as Bin).x0, (b[b.length - 1] as Bin).x1, K), w = step(), out = new Map<string, number[]>();
    for (const g of visible()) {
      const v = g.values, n = v.length;
      if (n < 2) continue;
      const scale = density() ? 1 : cumulative() ? n : n * w;
      let ys: number[];
      if (kind === "normal") { const m = mean(v), sd = deviation(v); ys = xsD.map((x) => (cumulative() ? normalCdf(x, m, sd) : normalPdf(x, m, sd)) * scale); } else ys = kde(v, xsD, num(read(props.bandwidth)) ?? silverman(v), cumulative()).map((y) => y * scale);
      out.set(g.key, ys);
    }
    return out;
  });

  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const xFmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.xFormat)));
  const yNice = computed(() => {
    let hi = 0;
    const hs = heights(), cd = curveData();
    for (const g of visible()) for (const v of hs.get(g.key)?.ys ?? []) hi = Math.max(hi, v);
    for (const ys of cd.values()) for (const v of ys) hi = Math.max(hi, v);
    return niceTicks(0, num(read(props.yMax)) ?? (hi || 1), Math.max(2, Math.floor((size.height() - 40) / 40)));
  });
  const xTitle = computed(() => read(props.xTitle) ?? ""), yTitle = computed(() => read(props.yTitle) ?? "");
  const box = computed((): Box => {
    const f = fmt(), ml = Math.min(120, Math.max(32, 12 + Math.max(0, ...yNice().ticks.map((v) => textWidth(f(v)))))) + (yTitle() ? 20 : 0);
    const mb = 28 + (xTitle() ? 18 : 0);
    return { x: ml, y: 12, w: Math.max(10, size.width() - ml - 18), h: Math.max(10, size.height() - 12 - mb) };
  }, { equals: sameBox });
  const xDomain = computed((): [number, number] => { const b = bins(); return b.length ? [(b[0] as Bin).x0, (b[b.length - 1] as Bin).x1] : [0, 1]; }, { equals: (a, b) => !!a && a[0] === b[0] && a[1] === b[1] });
  const xs = computed(() => scaleLinear(xDomain(), [0, box().w]));
  const ys = computed(() => scaleLinear([yNice().min, yNice().max], [box().h, 0]));
  const xTicks = computed((): Tick[] => {
    const s = xs(), f = xFmt(), b = bins(), n = Math.max(2, Math.floor(box().w / 70));
    // the bin edges when they fit, else nice values inside the range
    const edges = b.length + 1 <= n ? [...b.map((x) => x.x0), (b[b.length - 1] as Bin | undefined)?.x1 ?? 1] : s.ticks(n);
    return edges.map((v) => ({ key: v, pos: f1(s(v)), label: f(v) }));
  });
  const yTicks = computed((): Tick[] => { const s = ys(), f = fmt(); return yNice().ticks.map((v) => ({ key: v, pos: f1(s(v)), label: f(v) })); });

  const bars = computed((): Bar[] => {
    const b = bins(), sx = xs(), sy = ys(), hs = heights(), gap = Math.max(0, num(read(props.gap)) ?? 1), base = sy(0), out: Bar[] = [];
    for (const g of visible()) {
      const y = hs.get(g.key)?.ys ?? [];
      b.forEach((bin, i) => {
        const a = sx(bin.x0), z = sx(bin.x1), top = sy(y[i] ?? 0), w = Math.max(0, z - a - gap);
        out.push({ key: `${g.key}|${i}`, i, gi: g.index, x: a + Math.min(gap, z - a) / 2, y: top, w, h: Math.max(0, base - top) });
      });
    }
    return out;
  });
  const curves = computed((): Curve[] => {
    const cd = curveData(), sx = xs(), sy = ys(), b = bins(), out: Curve[] = [];
    if (!b.length) return out;
    const xsP = samples((b[0] as Bin).x0, (b[b.length - 1] as Bin).x1, K).map((x) => sx(x)), base = sy(0);
    for (const g of visible()) { const yv = cd.get(g.key); if (yv) out.push({ key: g.key, gi: g.index, xs: xsP, ys: yv.map((y) => sy(y)), base }); }
    return out;
  });

  // ---- interaction
  const label = (b: Bin): string => `${xFmt()(b.x0)} – ${xFmt()(b.x1)}`;
  const legendLabel = (k: string): string => String(legendItems().find((g) => g.key === k)?.label ?? k);
  const pointAt = (i: number): HistogramPoint | undefined => {
    const b = bins()[i];
    if (!b) return undefined;
    const counts: Record<string, number> = {}, values: Record<string, number> = {}, hs = heights(), vis = visible();
    for (const g of vis) { counts[g.key] = hs.get(g.key)?.counts[i] ?? 0; values[g.key] = hs.get(g.key)?.ys[i] ?? 0; }
    const first = vis[0]?.key;
    return { index: i, x0: b.x0, x1: b.x1, label: label(b), counts, values, group: props.group != null ? first ?? null : null, count: first != null ? counts[first] ?? 0 : 0, value: first != null ? values[first] ?? 0 : 0 };
  };
  const unit = (): string => (cumulative() && density() ? t`Share` : density() ? t`Density` : t`Count`);
  const show = (i: number): void => {
    active.set(i);
    const opt = read(props.tooltip), p = i < 0 ? undefined : pointAt(i);
    if (!p || opt === false) return void tip.at.set(null);
    const bx = box(), top = Math.max(0, Math.min(...visible().map((g) => ys()(p.values[g.key] ?? 0)), bx.h));
    const content = typeof opt === "function" ? () => opt(p) : () => tipBody(p.label, visible().map((g) => ({
      label: props.group != null ? legendLabel(g.key) : read(props.yLabel) ?? unit(),
      value: fmt()(p.values[g.key]), index: g.index })), props.colors);
    showTip(tip, svg, size.width(), bx.x + (xs()(p.x0) + xs()(p.x1)) / 2, bx.y + top, content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const select = (i = active.peek()): void => { const p = pointAt(i); if (p) props.onSelect?.(p); };
  const binAt = (e: PointerEvent): number => {
    const v = xs().invert(localPoint(svg, e, size.width())[0] - box().x), b = bins();
    if (!b.length) return -1;
    return Math.max(0, Math.min(b.length - 1, Math.floor((v - (b[0] as Bin).x0) / step())));
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const i = navIndex(e.key, active.peek(), 0, bins().length - 1);
    if (i == null || !bins().length) return;
    e.preventDefault();
    show(i);
  };

  // `x: "average" | "median" | "min" | "max"` → a line at that statistic of a group's raw values
  const resolved = computed((): RefMark[] => (read(props.marks) ?? []).map((m) => {
    if (typeof m.x !== "string" || !STATS.has(m.x)) return m;
    const g = visible().find((x) => m.series == null || x.key === m.series), v = g ? statOf(g.values, m.x as RefStat) : null;
    if (v == null) return { ...m, x: undefined };
    const name = m.x === "average" ? t`Average` : m.x === "median" ? t`Median` : m.x === "min" ? t`Min` : t`Max`;
    return { ...m, x: v, label: m.label ?? `${name} ${xFmt()(Math.round(v * 100) / 100)}` };
  }));
  const scales = {
    box,
    x: (v: unknown): number | null => { const n = num(v); return n == null ? null : xs()(n); },
    y: (v: number): number | null => ys()(v),
    stat: (s: RefStat, series: string | undefined): number | null => { const g = visible().find((x) => series == null || x.key === series); return g ? statOf(heights().get(g.key)?.ys ?? [], s) : null; },
    fmtX: (v: unknown): unknown => xFmt()(v),
    fmtY: (v: unknown): unknown => fmt()(v),
  };

  const bp = presence(bars, (b) => b.key, how), cp = presence(curves, (c) => c.key, how);
  const overlay = computed(() => visible().length > 1);
  const body = [
    Grid({ dir: "h", ticks: () => (read(props.grid) ?? true ? yTicks() : []), box }),
    Axis({ side: "left", ticks: yTicks, box }),
    Axis({ side: "bottom", ticks: xTicks, box }),
    h("text", { class: "m-chart-axis-title m-histogram-x-title", "text-anchor": "middle", x: attr(() => f1(box().x + box().w / 2)), y: attr(() => f1(box().y + box().h + 40)) }, xTitle),
    h("text", { class: "m-chart-axis-title m-histogram-y-title", "text-anchor": "middle", transform: attr(() => `translate(14,${f1(box().y + box().h / 2)}) rotate(-90)`) }, yTitle),
    RefMarks({ marks: resolved, scales, layer: "back" }),
    h("g", { class: () => `m-chart-plot m-histogram-plot${overlay() ? " m-histogram-overlay" : ""}${active() >= 0 ? " m-histogram-hovering" : ""}`, transform: attr(() => `translate(${box().x},${box().y})`),
      onPointerMove: (e: PointerEvent) => { const i = binAt(e); if (i !== active.peek()) show(i); }, onPointerLeave: hide, onClick: () => select() },
    h("rect", { class: "m-histogram-surface", x: 0, y: 0, width: attr(() => box().w), height: attr(() => box().h) }),
    h("rect", { class: "m-chart-band m-histogram-band", y: 0, height: attr(() => box().h), visibility: () => (active() >= 0 ? "visible" : "hidden"),
      x: attr(() => { const b = bins()[Math.max(0, active())]; return b ? f1(xs()(b.x0)) : 0; }), width: attr(() => { const b = bins()[Math.max(0, active())]; return b ? f1(xs()(b.x1) - xs()(b.x0)) : 0; }) }),
    each<Present<Bar>>({ each: bp.items, key: (b) => b.key, children: (b) => {
      const k = untrack(b).key;
      const g = tween(() => { const q = b(); return q.leaving ? { ...q, y: q.y + q.h, h: 0 } : q; }, ["x", "y", "w", "h"], how, (to) => ({ ...to, y: to.y + to.h, h: 0 }),
        { index: () => b().i, key: k, leaving: () => !!b().leaving, onSettle: () => { if (b().leaving) bp.done(k); } });
      return h("rect", {
        class: () => `m-histogram-bar ${seriesClass(b().gi)}`, "class:m-chart-active": () => active() === b().i && !b().leaving,
        style: () => colorStyle(props.colors, b().gi), "data-key": k,
        x: attr(() => f1(g().x)), y: attr(() => f1(g().y)), width: attr(() => f1(Math.max(0, g().w))), height: attr(() => f1(Math.max(0, g().h))),
        onClick: (e: Event) => { e.stopPropagation(); if (!b().leaving) { show(b().i); select(b().i); } },
      });
    } }),
    each<Present<Curve>>({ each: cp.items, key: (c) => c.key, children: (c) => {
      const k = untrack(c).key;
      const flat = (q: Curve): Curve => ({ ...q, ys: q.ys.map(() => q.base) });
      const g = tween(() => { const q = c(); return q.leaving ? flat(q) : q; }, ["xs", "ys"], how, flat,
        { key: `curve:${k}`, leaving: () => !!c().leaving, onSettle: () => { if (c().leaving) cp.done(k); } });
      return h("path", { class: () => `m-histogram-curve ${seriesClass(c().gi)}`, style: () => colorStyle(props.colors, c().gi),
        d: attr(() => { const q = g(); return linePath(q.xs.map((x, i) => [x, q.ys[i] as number] as const), "smooth"); }) });
    } })),
    RefMarks({ marks: resolved, scales, layer: "front" }),
  ];

  return Frame<Bin>(props, {
    kind: "histogram", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => groups().length === 0, tip,
    legend: { items: () => { const l = read(props.legend); return props.group == null || l === false || (l == null && groups().length < 2) ? [] : legendItems(); }, hidden },
    table: {
      caption: () => read(props.title), rows: bins,
      columns: () => [{ label: read(props.xLabel) ?? t`Range`, value: (b: Bin) => untrack(() => label(b)) },
        ...groups().map((g) => ({ label: props.group != null ? legendLabel(g.key) : read(props.yLabel) ?? unit(), value: (b: Bin) => untrack(() => fmt()(heights().get(g.key)?.ys[b.index] ?? 0)) }))],
    },
  });
}
