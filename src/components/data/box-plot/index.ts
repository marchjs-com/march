// BoxPlot: per category, raw values → quartiles, whiskers, outliers and the mean; or a violin (kernel density
// silhouette) with the box inside (march/charts). Folder: src/components/data/box-plot/; shared chart parts are in
// src/charts/, the statistics in src/charts/stats.ts.
// Each category is one keyed presence mark whose geometry (quartiles, whiskers, violin widths) tweens as numbers: a box
// grows out of its median, morphs to new data and collapses back into it when it leaves.
import "./box-plot.css";
import { signal, computed, read, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { scaleLinear, scaleBand, niceTicks } from "../../../charts/scale.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, useSize, attr, textWidth, localPoint, navIndex, sameBox, each, f1,
  type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp, type Box } from "../../../charts/util.ts";
import { tween, presence, animateOf, type AnimateProp, type Present } from "../../../charts/motion.ts";
import { Frame, Axis, Grid, tooltipState, showTip, tipBody, thin, type Tick, type LegendItem } from "../../../charts/parts.ts";
import { RefMarks, statOf, type RefMark, type RefMarksProp, type RefStat } from "../../../charts/marks.ts";
import { finite, mean, quantile, kde, silverman, samples } from "../../../charts/stats.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import type { Handler } from "../../../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** Five-number summary and more of one category. */
export interface BoxStats { n: number; min: number; q1: number; median: number; q3: number; max: number; mean: number; low: number; high: number; outliers: number[] }
/** Point passed to `tooltip(point)` and `onSelect(point)` of a box plot. */
export interface BoxPoint { index: number; key: string; label: string; stats: BoxStats; values: readonly number[] }

export interface BoxPlotProps<D = unknown> extends ChartBaseProps {
  /** Rows: one row per value (`{ label, value }`) or one per category with a list (`{ label, value: [..] }`). @tr Satırlar: değer başına bir satır (`{ label, value }`) ya da liste taşıyan kategori başına bir satır (`{ label, value: [..] }`). */
  data?: DataProp<D>;
  /** The category: a key or getter (default "label"). @tr Kategori: bir anahtar ya da getter (varsayılan "label"). */
  x?: Field<D> | undefined;
  /** The value or the list of values: a key or getter (default "value"). @tr Değer ya da değer listesi: bir anahtar ya da getter (varsayılan "value"). */
  y?: Field<D> | undefined;
  /** "box" (default), "violin" (kernel density silhouette) or "both" (a slim box inside the violin). @tr "box" (varsayılan), "violin" (çekirdek yoğunluğu silüeti) ya da "both" (kemanın içinde ince bir kutu). */
  mode?: Opt<"box" | "violin" | "both">;
  /** Whisker reach: "iqr" (default, 1.5 × IQR), "minmax" (no outliers) or an IQR multiple. @tr Bıyık erimi: "iqr" (varsayılan, 1.5 × IQR), "minmax" (aykırı yok) ya da bir IQR katı. */
  whisker?: Opt<"iqr" | "minmax" | number>;
  /** Dots for the values beyond the whiskers (default true). @tr Bıyıkların ötesindeki değerler için noktalar (varsayılan true). */
  outliers?: Opt<boolean>;
  /** A diamond at the mean (default true). @tr Ortalamada bir karo (varsayılan true). */
  mean?: Opt<boolean>;
  /** Every raw value as a jittered dot beside the box (the jitter is deterministic). @tr Her ham değer kutunun yanında saçılmış bir nokta (saçılma belirlenimlidir). */
  showPoints?: Opt<boolean>;
  /** Jitter width as a share of the box width (0..1, default 0.7). @tr Saçılma genişliği, kutu genişliğinin payı olarak (0..1, varsayılan 0.7). */
  jitter?: Opt<number>;
  /** Categories on the y axis, boxes lie down. @tr Kategoriler y ekseninde, kutular yatar. */
  horizontal?: Opt<boolean>;
  /** Kernel bandwidth of the violins in value units (default Silverman's rule per category). @tr Kemanların çekirdek genişliği, değer biriminde (varsayılan kategori başına Silverman kuralı). */
  bandwidth?: Opt<number>;
  /** Box width as a share of the category band (0.1..1, default 0.6). @tr Kutu genişliği, kategori bandının payı olarak (0.1..1, varsayılan 0.6). */
  boxWidth?: Opt<number>;
  /** Value format for axis, tooltip and table (default "number"). @tr Eksen, araç ipucu ve tablo için değer biçimi (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Format of the category labels. @tr Kategori etiketlerinin biçimi. */
  xFormat?: Opt<FormatSpec>;
  /** Fixes the low end of the value axis. @tr Değer ekseninin alt ucunu sabitler. */
  yMin?: Opt<number>;
  /** Fixes the high end of the value axis. @tr Değer ekseninin üst ucunu sabitler. */
  yMax?: Opt<number>;
  /** Grid lines along the value axis (default true). @tr Değer ekseni boyunca ızgara çizgileri (varsayılan true). */
  grid?: Opt<boolean>;
  /** Title of the value axis. @tr Değer ekseninin başlığı. */
  yTitle?: Opt<string>;
  /** Reference marks on the value axis: `y` lines and bands (targets, limits, "average" of every value). @tr Değer eksenindeki referans işaretleri: `y` çizgileri ve bantları (hedefler, sınırlar, tüm değerlerin "average"ı). */
  marks?: RefMarksProp;
  /** Header of the category column in the data table (default "Category"). @tr Veri tablosundaki kategori sütununun başlığı (varsayılan "Category"). */
  xLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<BoxPoint>;
  /** Called with the category on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki kategoride Enter / Space'e basılınca kategoriyle çağrılır. */
  onSelect?: Handler<[p: BoxPoint]> | undefined;
  /** Change animation: boxes and violins grow from the median, morph on a data change, collapse when they leave. `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or a function per box. @tr Değişim animasyonu: kutular ve kemanlar ortancadan büyür, veri değişince biçim değiştirir, çıkarken içine kapanır. `true` (varsayılan, yay), `false`, bir easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da kutu başına bir fonksiyon. */
  animate?: MaybeReactive<AnimateProp> | undefined;
}

interface Cat { key: string; index: number; values: number[]; stats: BoxStats }
/** One drawn category, in px: `c` the band centre, `w` the half width, the rest along the value axis. */
interface Shape { key: string; index: number; rank: number; c: number; w: number; bw: number; q1: number; q3: number; med: number; lo: number; hi: number; avg: number; v0: number; v1: number; vw: number[]; outs: number[]; dots: Dot[] }
interface Dot { key: string; c: number; v: number }

const K = 40;
/** Deterministic jitter in [-0.5, 0.5) for the i-th value of a category. */
const jitterOf = (i: number, seed: number): number => { const s = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return s - Math.floor(s) - 0.5; };
const hash = (s: string): number => { let x = 7; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 9973; return x; };

/** Quartiles, whiskers (`k` × IQR, or `Infinity` for min / max), outliers and the mean of some values. */
export function boxStats(values: readonly number[], k = 1.5): BoxStats | null {
  const s = values.filter((v) => isFinite(v)).sort((a, b) => a - b), n = s.length;
  if (!n) return null;
  const q1 = quantile(s, 0.25), median = quantile(s, 0.5), q3 = quantile(s, 0.75), iqr = q3 - q1;
  const lf = q1 - k * iqr, hf = q3 + k * iqr;
  let low = q1, high = q3;
  for (const v of s) if (v >= lf) { low = Math.min(v, q1); break; }
  for (let i = n - 1; i >= 0; i--) if ((s[i] as number) <= hf) { high = Math.max(s[i] as number, q3); break; }
  return { n, min: s[0] as number, q1, median, q3, max: s[n - 1] as number, mean: mean(s), low, high, outliers: s.filter((v) => v < low || v > high) };
}

/** Box plot / violin plot. */
export function BoxPlot<D>(props: BoxPlotProps<D>): Element {
  const size = useSize(props, 640, 280);
  const hidden = signal(new Set<string>()), active = signal(-1);
  const tip = tooltipState();
  const how = (): AnimateProp => animateOf(props.animate as AnimateProp | (() => AnimateProp));
  let svg: Element | null = null;

  const hz = computed(() => !!read(props.horizontal));
  const mode = computed(() => read(props.mode) ?? "box");
  const rows = computed(() => rowsOf(props.data));
  const kOf = computed(() => { const w = read(props.whisker); return w === "minmax" ? Infinity : typeof w === "number" && w >= 0 ? w : 1.5; });
  const cats = computed((): Cat[] => {
    const gx = accessor<D>(props.x ?? "label"), gy = accessor<D>(props.y ?? "value"), by = new Map<string, number[]>();
    rows().forEach((d, i) => {
      const k = String(gx(d, i) ?? ""), v = gy(d, i), list = by.get(k) ?? [];
      if (!by.has(k)) by.set(k, list);
      if (Array.isArray(v)) list.push(...finite(v)); else list.push(...finite([v]));
    });
    const out: Cat[] = [];
    for (const [key, values] of by) { const stats = boxStats(values, kOf()); if (stats) out.push({ key, index: out.length, values, stats }); }
    return out;
  });
  const xFmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.xFormat), (v) => String(v ?? "")));
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const legendItems = computed((): LegendItem[] => cats().map((c) => ({ key: c.key, label: xFmt()(c.key), index: c.index })));
  const visible = computed(() => cats().filter((c) => !hidden().has(c.key)));

  const nice = computed(() => {
    let lo = Infinity, hi = -Infinity;
    for (const c of visible()) { lo = Math.min(lo, c.stats.min); hi = Math.max(hi, c.stats.max); }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const len = hz() ? size.width() - 120 : size.height() - 40;
    return niceTicks(num(read(props.yMin)) ?? lo, num(read(props.yMax)) ?? hi, Math.max(2, Math.floor(len / (hz() ? 80 : 40))));
  });
  const yTitle = computed(() => read(props.yTitle) ?? "");
  const box = computed((): Box => {
    const t0 = 12, r = 18, title = yTitle() ? 20 : 0;
    if (hz()) {
      const ml = Math.min(160, Math.max(40, 12 + Math.max(0, ...visible().map((c) => textWidth(xFmt()(c.key))))));
      return { x: ml, y: t0, w: Math.max(10, size.width() - ml - r), h: Math.max(10, size.height() - t0 - 28 - title) };
    }
    const f = fmt(), ml = Math.min(120, Math.max(32, 12 + Math.max(0, ...nice().ticks.map((v) => textWidth(f(v)))))) + title;
    return { x: ml, y: t0, w: Math.max(10, size.width() - ml - r), h: Math.max(10, size.height() - t0 - 28) };
  }, { equals: sameBox });
  const vs = computed(() => { const b = box(); return scaleLinear([nice().min, nice().max], hz() ? [0, b.w] : [b.h, 0]); });
  const band = computed(() => { const b = box(); return scaleBand(visible().map((c) => c.key), [0, hz() ? b.h : b.w], { paddingInner: 0.25, paddingOuter: 0.15 }); });
  const valTicks = computed((): Tick[] => { const s = vs(), f = fmt(); return nice().ticks.map((v) => ({ key: v, pos: f1(s(v)), label: f(v) })); });
  const catTicks = computed((): Tick[] => {
    const bs = band(), f = xFmt(), len = hz() ? box().h / 22 : box().w / 60;
    return thin(visible(), Math.max(2, Math.floor(len))).map((c) => ({ key: c.key, pos: f1(bs.center(c.key)), label: f(c.key) }));
  });

  const shapes = computed((): Shape[] => {
    const bs = band(), v = vs(), m = mode(), vis = visible(), half = bs.bandwidth / 2;
    const share = Math.min(1, Math.max(0.1, num(read(props.boxWidth)) ?? 0.6)), jit = Math.min(1, Math.max(0, num(read(props.jitter)) ?? 0.7));
    const dots = !!read(props.showPoints), bwProp = num(read(props.bandwidth));
    // violins: one density scale for all, so their widths compare
    const dens = m === "box" ? [] : vis.map((c) => { const xs = samples(c.stats.min, c.stats.max, K); return { xs, ys: kde(c.values, xs, bwProp ?? silverman(c.values)) }; });
    const peak = Math.max(1e-12, ...dens.flatMap((d) => d.ys));
    return vis.map((c, rank): Shape => {
      const s = c.stats, cx = bs.center(c.key), w = m === "box" ? half * share : half * 0.95;
      const bw = m === "both" ? Math.max(3, half * 0.14) : half * share;
      const dd = dens[rank];
      const seed = hash(c.key);
      return {
        key: c.key, index: c.index, rank, c: cx, w, bw, q1: v(s.q1), q3: v(s.q3), med: v(s.median), lo: v(s.low), hi: v(s.high), avg: v(s.mean),
        v0: v(s.min), v1: v(s.max), vw: dd ? dd.ys.map((y) => (y / peak) * w) : Array.from({ length: K }, () => 0),
        outs: s.outliers.map((o) => v(o)),
        dots: dots ? c.values.map((val, i) => ({ key: `${i}`, c: cx + jitterOf(i, seed) * 2 * (m === "box" ? bw : w * 0.55) * jit, v: v(val) })) : [],
      };
    });
  });

  // ---- interaction
  const pointAt = (i: number): BoxPoint | undefined => { const c = visible()[i]; return c && { index: c.index, key: c.key, label: String(xFmt()(c.key)), stats: c.stats, values: c.values }; };
  const statRows = (s: BoxStats, index: number): { label: unknown; value: unknown; index: number }[] => {
    const f = fmt(), out = [
      { label: t`Max`, value: f(s.max), index }, { label: t`Q3`, value: f(s.q3), index }, { label: t`Median`, value: f(s.median), index },
      { label: t`Q1`, value: f(s.q1), index }, { label: t`Min`, value: f(s.min), index },
    ];
    if (read(props.mean) ?? true) out.push({ label: t`Mean`, value: f(Math.round(s.mean * 100) / 100), index });
    out.push({ label: t`Count`, value: String(s.n), index });
    if (s.outliers.length) out.push({ label: t`Outliers`, value: String(s.outliers.length), index });
    return out;
  };
  const show = (i: number): void => {
    active.set(i);
    const opt = read(props.tooltip), p = i < 0 ? undefined : pointAt(i), sh = shapes()[i];
    if (!p || !sh || opt === false) return void tip.at.set(null);
    const b = box();
    const content = typeof opt === "function" ? () => opt(p) : () => tipBody(p.label, statRows(p.stats, p.index), props.colors);
    if (hz()) showTip(tip, svg, size.width(), b.x + Math.max(sh.hi, sh.v1), b.y + sh.c, content);
    else showTip(tip, svg, size.width(), b.x + sh.c + sh.w, b.y + Math.min(sh.hi, sh.v1), content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const select = (i = active.peek()): void => { const p = pointAt(i); if (p) props.onSelect?.(p); };
  const catAt = (e: PointerEvent): number => {
    const [px, py] = localPoint(svg, e, size.width()), b = box(), k = band().invert(hz() ? py - b.y : px - b.x);
    return k == null ? -1 : visible().findIndex((c) => c.key === k);
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const i = navIndex(e.key, active.peek(), 0, visible().length - 1);
    if (i == null || !visible().length) return;
    e.preventDefault();
    show(i);
  };

  // marks: value lines / bands go across the categories (y on a vertical plot, x on a horizontal one)
  const resolved = computed((): RefMark[] => (read(props.marks) ?? []).map((m): RefMark => {
    if (!hz()) return m;
    const { y, ...rest } = m;
    return typeof y === "string" ? { ...rest, x: allStat(y as RefStat) ?? undefined, label: m.label ?? `${y} ${fmt()(allStat(y as RefStat))}` } : { ...rest, x: y };
  }));
  const allStat = (s: RefStat): number | null => statOf(visible().flatMap((c) => c.values), s);
  const scales = {
    box,
    x: (v: unknown): number | null => (hz() ? (num(v) == null ? null : vs()(num(v))) : (() => { const p = band().center(String(v)); return isFinite(p) ? p : null; })()),
    xBand: () => (hz() ? 0 : band().bandwidth),
    y: (v: number): number | null => (hz() ? null : vs()(v)),
    stat: (s: RefStat, series: string | undefined): number | null => statOf(visible().filter((c) => series == null || c.key === series).flatMap((c) => c.values), s),
    fmtX: (v: unknown): unknown => (hz() ? fmt()(v) : xFmt()(v)),
    fmtY: (v: unknown): unknown => fmt()(v),
  };

  const P = (c: number, v: number): string => (hz() ? `${f1(v)},${f1(c)}` : `${f1(c)},${f1(v)}`);
  const pr = presence(shapes, (s) => s.key, how);
  const collapse = (s: Shape): Shape => ({ ...s, q1: s.med, q3: s.med, lo: s.med, hi: s.med, avg: s.med, v0: s.med, v1: s.med, vw: s.vw.map(() => 0), w: 0, bw: 0 });
  const grow = (s: Shape): Shape => ({ ...s, q1: s.med, q3: s.med, lo: s.med, hi: s.med, avg: s.med, v0: s.med, v1: s.med, vw: s.vw.map(() => 0) });
  const meanOn = (): boolean => read(props.mean) ?? true, outOn = (): boolean => read(props.outliers) ?? true;

  const body = [
    () => { const horiz = hz(); return [
      Grid({ dir: horiz ? "v" : "h", ticks: () => (read(props.grid) ?? true ? valTicks() : []), box }),
      Axis({ side: horiz ? "bottom" : "left", ticks: valTicks, box }),
      Axis({ side: horiz ? "left" : "bottom", ticks: catTicks, box }),
      h("text", { class: "m-chart-axis-title m-boxplot-y-title", "text-anchor": "middle",
        ...(horiz ? { x: attr(() => f1(box().x + box().w / 2)), y: attr(() => f1(box().y + box().h + 40)) } : { transform: attr(() => `translate(14,${f1(box().y + box().h / 2)}) rotate(-90)`) }) }, yTitle),
    ]; },
    RefMarks({ marks: resolved, scales, layer: "back" }),
    h("g", { class: () => `m-chart-plot m-boxplot-plot m-boxplot-mode-${mode()}${active() >= 0 ? " m-boxplot-hovering" : ""}`, transform: attr(() => `translate(${box().x},${box().y})`),
      onPointerMove: (e: PointerEvent) => { const i = catAt(e); if (i !== active.peek()) show(i); }, onPointerLeave: hide, onClick: () => select() },
    h("rect", { class: "m-boxplot-surface", x: 0, y: 0, width: attr(() => box().w), height: attr(() => box().h) }),
    each<Present<Shape>>({ each: pr.items, key: (s) => s.key, children: (s) => {
      const k = untrack(s).key;
      const g = tween(() => { const q = s(); return q.leaving ? collapse(q) : q; }, ["c", "w", "bw", "q1", "q3", "med", "lo", "hi", "avg", "v0", "v1", "vw"], how, grow,
        { index: () => s().rank, key: k, leaving: () => !!s().leaving, onSettle: () => { if (s().leaving) pr.done(k); } });
      const violin = attr(() => {
        const q = g();
        if (mode() === "box" || (q.v1 === q.v0 && !q.vw.some((x) => x > 0))) return "";
        const at = (i: number): number => q.v0 + ((q.v1 - q.v0) * i) / (K - 1);
        let d = `M${P(q.c, q.v0)}`;
        for (let i = 0; i < K; i++) d += `L${P(q.c + (q.vw[i] as number), at(i))}`;
        for (let i = K - 1; i >= 0; i--) d += `L${P(q.c - (q.vw[i] as number), at(i))}`;
        return `${d}Z`;
      });
      return h("g", {
        class: () => `m-boxplot-item ${seriesClass(s().index)}`, "class:m-chart-active": () => !s().leaving && visible()[active()]?.key === k,
        "class:m-boxplot-leaving": () => !!s().leaving, style: () => colorStyle(props.colors, s().index), "data-key": k,
        onClick: (e: Event) => { e.stopPropagation(); const i = visible().findIndex((c) => c.key === k); if (i >= 0) { show(i); select(i); } },
      },
      h("path", { class: "m-boxplot-violin", d: violin }),
      h("path", { class: "m-boxplot-whisker", d: attr(() => { const q = g(), cw = q.bw * 0.5; return mode() === "violin" ? "" : `M${P(q.c, q.lo)}L${P(q.c, q.q1)}M${P(q.c, q.q3)}L${P(q.c, q.hi)}M${P(q.c - cw, q.lo)}L${P(q.c + cw, q.lo)}M${P(q.c - cw, q.hi)}L${P(q.c + cw, q.hi)}`; }) }),
      h("path", { class: "m-boxplot-box", d: attr(() => { const q = g(); return mode() === "violin" && q.bw ? `M${P(q.c, q.q1)}L${P(q.c, q.q3)}` : `M${P(q.c - q.bw, q.q1)}L${P(q.c + q.bw, q.q1)}L${P(q.c + q.bw, q.q3)}L${P(q.c - q.bw, q.q3)}Z`; }) }),
      h("path", { class: "m-boxplot-median", d: attr(() => { const q = g(), w = mode() === "violin" ? Math.max(4, q.bw * 0.4) : q.bw; return `M${P(q.c - w, q.med)}L${P(q.c + w, q.med)}`; }) }),
      h("path", { class: "m-boxplot-mean", d: attr(() => { if (!meanOn()) return ""; const q = g(), r = Math.min(4.5, Math.max(0, q.bw * 0.6)); return r ? `M${P(q.c, q.avg - r)}L${P(q.c + r, q.avg)}L${P(q.c, q.avg + r)}L${P(q.c - r, q.avg)}Z` : ""; }) }),
      each<number>({ each: () => (outOn() && !s().leaving ? s().outs.map((_, i) => i) : []), children: (i) => h("circle", { class: "m-boxplot-outlier", r: 3,
        cx: attr(() => { const v = s().outs[i()] ?? 0; return hz() ? f1(v) : f1(g().c); }), cy: attr(() => { const v = s().outs[i()] ?? 0; return hz() ? f1(g().c) : f1(v); }) }) }),
      each<Dot>({ each: () => (s().leaving ? [] : s().dots), key: (d) => d.key, children: (d) => {
        const dg = tween(d, ["c", "v"], how, (to) => ({ ...to, c: untrack(s).c, v: untrack(s).med }), { index: () => Number(untrack(d).key) % 40 });
        return h("circle", { class: "m-boxplot-dot", r: 2.25, cx: attr(() => (hz() ? f1(dg().v) : f1(dg().c))), cy: attr(() => (hz() ? f1(dg().c) : f1(dg().v))) });
      } }));
    } })),
    RefMarks({ marks: resolved, scales, layer: "front" }),
  ];

  return Frame<Cat>(props, {
    kind: "boxplot", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => cats().length === 0, tip,
    legend: { items: () => (read(props.legend) ? legendItems() : []), hidden },
    table: {
      caption: () => read(props.title), rows: cats,
      columns: () => {
        const f = (v: number): unknown => untrack(fmt)(Math.round(v * 100) / 100);
        return [{ label: read(props.xLabel) ?? t`Category`, value: (c: Cat) => untrack(xFmt)(c.key) }, { label: t`Count`, value: (c: Cat) => c.stats.n },
          { label: t`Min`, value: (c: Cat) => f(c.stats.min) }, { label: t`Q1`, value: (c: Cat) => f(c.stats.q1) }, { label: t`Median`, value: (c: Cat) => f(c.stats.median) },
          { label: t`Q3`, value: (c: Cat) => f(c.stats.q3) }, { label: t`Max`, value: (c: Cat) => f(c.stats.max) }, { label: t`Mean`, value: (c: Cat) => f(c.stats.mean) }];
      },
    },
  });
}
