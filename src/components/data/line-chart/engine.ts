// The x/y engine behind LineChart, AreaChart, ComboChart and StreamGraph (index.ts re-exports the public part): x/y charts with zoom, keyboard points and a data table (march/charts). Folder:
// src/components/data/line-chart/; shared chart parts (scales, axes, tooltip, data table, formats, motion) are in src/charts/.
// x (time / number / category) against one or more series; a series is a line, an area or bars, on the left or the
// right value axis. The chart is kept in data space (morph.ts): on a data change the domains and every point's value
// tween on the motion engine, points matched by x, so live data slides, values morph and series grow or sink.
import "./line-chart.css";
import { signal, computed, read, untrack, effect, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { scaleLinear, niceTicks, timeTicks } from "../../../charts/scale.ts";
import { lttb } from "../../../charts/lttb.ts";
import { rowsOf, accessor, formatter, num, seriesOf, seriesClass, colorStyle, xKind, timeMs, timeFormat, timeDetail, useSize, attr, textWidth, localPoint, navIndex, sameBox, each, nextId,
  type MaybeReactive, type DataProp, type Field, type SeriesSpec, type SeriesLabels, type FormatSpec, type Formatter, type ChartBaseProps, type ChartPoint, type TooltipProp, type Box, type Series, type XKind, type Getter, f1 } from "../../../charts/util.ts";
import { Frame, Axis, Grid, tooltipState, showTip, tipBody, thin, type Tick } from "../../../charts/parts.ts";
import { animateOf, playMarks, type AnimateProp } from "../../../charts/motion.ts";
import { linePath, areaPath, dashOf, type Curve, type Pt } from "../../../charts/curve.ts";
import { RefMarks, statOf, type RefMarksProp } from "../../../charts/marks.ts";
import { syncGroup, windowRange, type WindowProp } from "../../../charts/sync.ts";
import { Navigator, type NavPath } from "../../../charts/navigator.ts";
import { between, type Snap, type MSeries, type MPoint } from "./morph.ts";
import { clamp, type Handler } from "../../../core/util.ts";
import { isActivateKey } from "../../../ui/behave.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;
/** Point marker shape. */
export type MarkerShape = "circle" | "square" | "diamond" | "triangle";
/** A series with its own look: a line, an area or bars, on the left or right axis. */
export interface SeriesOptions<D = unknown> {
  /** Series key (legend toggling, classes; also the row key read when `value` is not given). @tr Seri anahtarı (gösterge, sınıflar; `value` verilmezse okunan satır anahtarı da budur). */
  key: string;
  /** The value: a row key or `(row, i) => value` (default `key`). @tr Değer: bir satır anahtarı ya da `(row, i) => value` (varsayılan `key`). */
  value?: Field<D> | undefined;
  /** Label in legend, tooltip and table. @tr Gösterge, araç ipucu ve tablodaki etiket. */
  label?: string | undefined;
  /** "line", "area" or "bar" (default the chart's kind). @tr "line", "area" ya da "bar" (varsayılan grafiğin türü). */
  type?: "line" | "area" | "bar" | undefined;
  /** Value axis: "left" (default) or "right" (a second axis appears). @tr Değer ekseni: "left" (varsayılan) ya da "right" (ikinci eksen çıkar). */
  axis?: "left" | "right" | undefined;
  /** Line shape (default the chart's `curve`). @tr Çizgi biçimi (varsayılan grafiğin `curve` değeri). */
  curve?: Curve | undefined;
  /** "solid", "dashed", "dotted" or a dash array. @tr "solid", "dashed", "dotted" ya da bir kesik dizisi. */
  dash?: string | undefined;
  /** Point markers for this series (default the chart's `markers`). @tr Bu serinin nokta işaretleri (varsayılan grafiğin `markers` değeri). */
  marker?: boolean | MarkerShape | undefined;
}
export type YSpec<D> = SeriesSpec<D> | SeriesOptions<D>;

export interface XYChartProps<D = unknown> extends ChartBaseProps {
  /** Rows: an array (or signal / function returning one) of objects. @tr Satırlar: nesnelerden oluşan bir dizi (ya da onu döndüren sinyal / fonksiyon). */
  data?: DataProp<D>;
  /** The x value: a key or `(row, i) => value` (default the index). Dates → time axis, numbers → linear, else categories. @tr x değeri: bir anahtar ya da `(row, i) => value` (varsayılan sıra numarası). Tarihler → zaman ekseni, sayılar → doğrusal, diğerleri → kategoriler. */
  x?: Field<D> | undefined;
  /** Value series: a key, a getter, `{ key, value, label, type, axis, curve, dash, marker }`, or a list of them (default "y"). @tr Değer serileri: bir anahtar, bir getter, `{ key, value, label, type, axis, curve, dash, marker }` ya da bunların listesi (varsayılan "y"). */
  y?: YSpec<D> | readonly YSpec<D>[] | undefined;
  /** Series labels for legend, tooltip and table: aligned with `y`, keyed by series key, or one label. @tr Gösterge, araç ipucu ve tablo için seri etiketleri: `y` ile sıralı, seri anahtarına göre ya da tek bir etiket. */
  series?: SeriesLabels | undefined;
  /** Forces the x scale: "time", "linear" or "band" (default detected from the data). @tr x ölçeğini zorlar: "time", "linear" ya da "band" (varsayılan veriden anlaşılır). */
  xType?: Opt<XKind>;
  /** Format of the x labels: a pipe name, `[pipe, ...args]` or a function; time axes pick one by default. @tr x etiketlerinin biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon; zaman eksenleri varsayılanı kendisi seçer. */
  xFormat?: Opt<FormatSpec>;
  /** Value format for axis, tooltip and table: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Eksen, araç ipucu ve tablo için değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Format of the right axis (series with `axis: "right"`; default `format`). @tr Sağ eksenin biçimi (`axis: "right"` serileri; varsayılan `format`). */
  y2Format?: Opt<FormatSpec>;
  /** Fixes the low end of the value axis (still rounded to nice ticks). @tr Değer ekseninin alt ucunu sabitler (yine de düzgün çentiklere yuvarlanır). */
  yMin?: Opt<number>;
  /** Fixes the high end of the value axis (still rounded to nice ticks). @tr Değer ekseninin üst ucunu sabitler (yine de düzgün çentiklere yuvarlanır). */
  yMax?: Opt<number>;
  /** Low end of the right axis. @tr Sağ eksenin alt ucu. */
  y2Min?: Opt<number>;
  /** High end of the right axis. @tr Sağ eksenin üst ucu. */
  y2Max?: Opt<number>;
  /** Include 0 in the value axis (area and bar series always do). @tr Değer eksenine 0'ı katar (alan ve çubuk serileri her zaman katar). */
  zero?: Opt<boolean>;
  /** Axis titles: under the x axis, beside the left and the right axis. @tr Eksen başlıkları: x ekseninin altında, sol ve sağ eksenin yanında. */
  xTitle?: Opt<string>;
  /** Title of the left value axis. @tr Sol değer ekseninin başlığı. */
  yTitle?: Opt<string>;
  /** Title of the right value axis. @tr Sağ değer ekseninin başlığı. */
  y2Title?: Opt<string>;
  /** Grid lines: `true` (default, horizontal), `false`, "x" (vertical only) or "both". @tr Izgara çizgileri: `true` (varsayılan, yatay), `false`, "x" (yalnız dikey) ya da "both" (ikisi). */
  grid?: Opt<boolean | "x" | "both">;
  /** Line shape: "linear" (default), "smooth" (never overshoots), "step", "step-before", "step-after". @tr Çizgi biçimi: "linear" (varsayılan), "smooth" (veriyi aşmaz), "step", "step-before", "step-after". */
  curve?: Opt<Curve>;
  /** Point markers: `true` (circles), a shape ("circle", "square", "diamond", "triangle") or "auto" (when points are few). @tr Nokta işaretleri: `true` (daire), bir biçim ("circle", "square", "diamond", "triangle") ya da "auto" (nokta az olunca). */
  markers?: Opt<boolean | MarkerShape | "auto">;
  /** Draw across missing values instead of leaving a gap (default false). @tr Eksik değerlerde boşluk bırakmak yerine çizgiyi sürdürür (varsayılan false). */
  connectNulls?: Opt<boolean>;
  /** Reference lines, bands, averages and point notes: `[{ y: 100, label: "Hedef" }, { y: "average" }, { x: [from, to] }, { at: [x, y], label }]`. @tr Referans çizgileri, bantlar, ortalamalar ve nokta notları: `[{ y: 100, label: "Hedef" }, { y: "average" }, { x: [from, to] }, { at: [x, y], label }]`. */
  marks?: RefMarksProp;
  /** Live window: show the last N rows, or `{ last: n }` / `{ ms: span }` of a time axis; data may keep growing. @tr Canlı pencere: son N satırı ya da zaman ekseninde `{ last: n }` / `{ ms: span }` gösterir; veri büyümeye devam edebilir. */
  window?: Opt<WindowProp>;
  /** Range navigator under the chart (an overview with a draggable window): `true` or its height. @tr Grafiğin altında aralık gezgini (sürüklenebilir pencereli genel görünüm): `true` ya da yüksekliği. */
  navigator?: Opt<boolean | number>;
  /** Charts with the same `sync` name share the crosshair (hover one, all show that x). @tr Aynı `sync` adlı grafikler artı imlecini paylaşır (birinin üstüne gelince hepsi o x'i gösterir). */
  sync?: Opt<string>;
  /** Above this many points a series is downsampled with LTTB (default 2 × plot width). @tr Bir seri bu kadar noktayı aşınca LTTB ile seyreltilir (varsayılan 2 × çizim genişliği). */
  maxPoints?: Opt<number>;
  /** Drag across the plot to zoom into an x range; double click, Escape or "Reset zoom" resets. @tr Bir x aralığına yakınlaşmak için çizim üzerinde sürükleyin; çift tıklama, Escape ya da "Reset zoom" sıfırlar. */
  zoom?: Opt<boolean>;
  /** Text of the reset button (default "Reset zoom"). @tr Sıfırlama düğmesinin yazısı (varsayılan "Reset zoom"). */
  resetLabel?: Opt<string>;
  /** Header of the x column in the data table (default the x key). @tr Veri tablosundaki x sütununun başlığı (varsayılan x anahtarı). */
  xLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<ChartPoint<D>>;
  /** Called with the point on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki öğede Enter / Space'e basılınca noktayla çağrılır. */
  onSelect?: Handler<[p: ChartPoint<D>]> | undefined;
  /** Change animations: lines rise in, values morph, live data slides, hidden series sink. `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. @tr Değişim animasyonları: çizgiler yükselerek gelir, değerler dönüşür, canlı veri kayar, gizlenen seriler alçalır. `true` (varsayılan, yay), `false`, bir easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da `(ctx) => …`. */
  animate?: AnimateProp | (() => AnimateProp);
}
export type LineChartProps<D = unknown> = XYChartProps<D>;
export interface AreaChartProps<D = unknown> extends XYChartProps<D> {
  /** Stack the visible series. @tr Görünen serileri üst üste yığar. */
  stacked?: Opt<boolean>;
  /** Stack baseline: "zero" (default), "expand" (shares of 100 %), "silhouette" (centred) or "wiggle" (a stream graph). @tr Yığın tabanı: "zero" (varsayılan), "expand" (%100 payları), "silhouette" (ortalı) ya da "wiggle" (akış grafiği). */
  offset?: Opt<"zero" | "expand" | "silhouette" | "wiggle">;
}
export type ComboChartProps<D = unknown> = AreaChartProps<D>;

/** Line chart. See docs.md for props. */
export function LineChart<D>(props: LineChartProps<D>): Element { return xyChart(props, "line"); }
/** Area chart (`stacked` stacks the visible series; `offset` picks the baseline). */
export function AreaChart<D>(props: AreaChartProps<D>): Element { return xyChart(props, "area"); }
/** Bars and lines on one x axis, often with a second value axis: give each series a `type` and an `axis`. */
export function ComboChart<D>(props: ComboChartProps<D>): Element { return xyChart(props, "bar"); }

interface XSeries<D> extends Series<D> { type: "line" | "area" | "bar"; axis: "left" | "right"; curve?: Curve | undefined; dash?: string | undefined; marker?: boolean | MarkerShape | undefined }
type Stack = Map<string, { lo: number[] | null; hi: (number | null)[] }>;
const M = { t: 12, r: 16, b: 28 };
const isOpts = <D>(s: YSpec<D>): s is SeriesOptions<D> => typeof s === "object" && s !== null;

/** The x/y engine (LineChart, AreaChart, ComboChart, StreamGraph). */
export function xyChart<D>(props: AreaChartProps<D>, kind: "line" | "area" | "bar", chartClass?: string): Element {
  const size = useSize(props, 640, 240);
  const hidden = signal(new Set<string>()), active = signal(-1), zoom = signal<[number, number] | null>(null), drag = signal<[number, number] | null>(null);
  const tip = tooltipState();
  const id = nextId("m-xy");
  let svg: Element | null = null, dragged = false;

  const rows = computed(() => rowsOf(props.data));
  const series = computed((): XSeries<D>[] => {
    const raw = props.y, list: readonly YSpec<D>[] = Array.isArray(raw) ? raw : [(raw as YSpec<D> | undefined) ?? "y"];
    const specs = list.map((s): SeriesSpec<D> => (isOpts(s) ? Object.assign(accessor<D>(s.value ?? s.key) as Getter<D> & { key?: string }, { key: s.key }) : s));
    const labels: SeriesLabels | undefined = props.series ?? (list.some(isOpts) ? Object.fromEntries(list.filter(isOpts).filter((s) => s.label).map((s) => [s.key, s.label as string])) : undefined);
    return seriesOf(specs, labels).map((s, i) => {
      const o = list[i] as YSpec<D>, opt = isOpts(o) ? o : null;
      return { ...s, type: opt?.type ?? (kind === "bar" ? "bar" : kind), axis: opt?.axis ?? "left", curve: opt?.curve, dash: opt?.dash, marker: opt?.marker };
    });
  });
  const visible = computed(() => series().filter((s) => !hidden().has(s.key)));
  const hasRight = computed(() => visible().some((s) => s.axis === "right"));
  const bars = computed(() => visible().filter((s) => s.type === "bar"));
  const xRaw = computed(() => { const g = accessor<D>(props.x, (d, i) => i); return rows().map((d, i) => g(d, i)); });
  const xType = computed(() => xKind(xRaw(), read(props.xType)));
  const xNum = computed((): number[] => { const t = xType(), r = xRaw(); return t === "time" ? r.map(timeMs) : t === "linear" ? r.map(Number) : r.map((_, i) => i); });
  const sorted = computed(() => { const v = xNum(); for (let i = 1; i < v.length; i++) if ((v[i] as number) < (v[i - 1] as number)) return false; return true; });
  const range = computed((): [number, number] => {
    const n = rows().length, z = zoom();
    if (z) return [Math.max(0, z[0]), Math.min(n - 1, z[1])];
    return sorted() ? windowRange(n, xNum(), read(props.window)) : [0, n - 1];
  }, { equals: (a, b) => !!a && a[0] === b[0] && a[1] === b[1] });
  const stacked = computed(() => kind === "area" && !!read(props.stacked));
  const offset = computed(() => (stacked() ? read(props.offset) ?? "zero" : "zero"));

  // per series: hi (value or stacked top) and lo (stacked base, or null); stacking takes the area series of each axis
  const stack = computed((): Stack => {
    const r = rows(), out: Stack = new Map(), vis = visible();
    const vals = new Map(vis.map((s) => [s.key, r.map((d, i) => num(s.get(d, i)))]));
    const stackers = stacked() ? vis.filter((s) => s.type === "area") : [];
    for (const s of vis) if (!stackers.includes(s)) out.set(s.key, { lo: null, hi: vals.get(s.key) as (number | null)[] });
    if (!stackers.length) return out;
    const n = r.length, off = offset();
    const sums = new Array<number>(n).fill(0);
    for (const s of stackers) (vals.get(s.key) as (number | null)[]).forEach((v, i) => { sums[i] = (sums[i] as number) + Math.max(0, v ?? 0); });
    const base = new Array<number>(n).fill(0);
    if (off === "silhouette") for (let i = 0; i < n; i++) base[i] = -(sums[i] as number) / 2;
    if (off === "wiggle") { // Byron & Wattenberg's streamgraph baseline
      let y = 0;
      for (let j = 1; j < n; j++) {
        let s1 = 0, s2 = 0;
        stackers.forEach((s, i) => {
          const v = vals.get(s.key) as (number | null)[], a = v[j] ?? 0;
          let s3 = (a - (v[j - 1] ?? 0)) / 2;
          for (let k = 0; k < i; k++) { const w = vals.get((stackers[k] as XSeries<D>).key) as (number | null)[]; s3 += (w[j] ?? 0) - (w[j - 1] ?? 0); }
          s1 += a; s2 += s3 * a;
        });
        if (s1) y -= s2 / s1;
        base[j] = y;
      }
      const mid = base.reduce((a, b, i) => a + b + (sums[i] as number) / 2, 0) / (n || 1);
      for (let i = 0; i < n; i++) base[i] = (base[i] as number) - mid;
    }
    let lo = base.slice();
    for (const s of stackers) {
      const v = vals.get(s.key) as (number | null)[];
      const k = (i: number): number => (off === "expand" ? ((sums[i] as number) ? 1 / (sums[i] as number) : 0) : 1);
      const hi = v.map((x, i) => (lo[i] as number) + Math.max(0, x ?? 0) * k(i));
      out.set(s.key, { lo: lo.slice(), hi });
      lo = hi;
    }
    return out;
  });

  const yFmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format), offset() === "expand" ? (v) => applyPipe("percent", v) : undefined));
  const y2Fmt = computed(() => { const f = read<FormatSpec | null | undefined>(props.y2Format); return f != null ? formatter(f) : yFmt(); });
  const niceFor = (axis: "left" | "right") => computed(() => {
    const [a, b] = range(), st = stack();
    let lo = Infinity, hi = -Infinity, fill = false;
    for (const s of visible()) {
      if (s.axis !== axis) continue;
      if (s.type !== "line") fill = true;
      const v = st.get(s.key);
      if (!v) continue;
      for (let i = a; i <= b; i++) { for (const x of [v.hi[i], v.lo?.[i]]) if (x != null) { if (x < lo) lo = x; if (x > hi) hi = x; } }
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if ((fill && offset() === "zero") || read(props.zero)) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (axis === "left") { lo = num(read(props.yMin)) ?? lo; hi = num(read(props.yMax)) ?? hi; } else { lo = num(read(props.y2Min)) ?? lo; hi = num(read(props.y2Max)) ?? hi; }
    if (offset() === "expand" && axis === "left") { lo = 0; hi = 1; }
    return niceTicks(lo, hi, Math.max(2, Math.floor((size.height() - M.t - M.b) / 40)));
  });
  const yNice = niceFor("left"), y2Nice = niceFor("right");
  const stream = computed(() => offset() === "wiggle" || offset() === "silhouette");
  const box = computed((): Box => {
    const lab = (f: Formatter, ticks: readonly number[]): number => Math.min(120, Math.max(32, 12 + Math.max(0, ...ticks.map((t) => textWidth(f(t))))));
    const ml = stream() ? 12 : lab(yFmt(), yNice().ticks) + (read(props.yTitle) ? 18 : 0);
    const mr = hasRight() ? lab(y2Fmt(), y2Nice().ticks) + (read(props.y2Title) ? 18 : 0) : M.r;
    const mb = M.b + (read(props.xTitle) ? 18 : 0);
    return { x: ml, y: M.t, w: Math.max(10, size.width() - ml - mr), h: Math.max(10, size.height() - M.t - mb) };
  }, { equals: sameBox });
  // bars need room at the ends: half a slot on each side
  const slot = computed((): number => {
    if (!bars().length) return 0;
    if (xType() === "band") return 1;
    const v = xNum(), [a, b] = range();
    let m = Infinity;
    for (let i = a + 1; i <= b; i++) { const d = Math.abs((v[i] as number) - (v[i - 1] as number)); if (d > 0 && d < m) m = d; }
    return isFinite(m) ? m : 1;
  });
  const xDomain = computed((): [number, number] => {
    const [a, b] = range(), v = xNum();
    let lo = Infinity, hi = -Infinity;
    for (let i = a; i <= b; i++) { const x = v[i] as number; if (x < lo) lo = x; if (x > hi) hi = x; }
    if (!isFinite(lo)) return [0, 1];
    const pad = slot() / 2;
    return lo === hi && !pad ? [lo - 1, hi + 1] : [lo - pad, hi + pad];
  });
  const xFormatOf = (time: (spanMs: number) => Formatter) => computed((): Formatter => {
    const f = read<FormatSpec | null | undefined>(props.xFormat);
    if (f != null) return formatter(f);
    const t = xType();
    if (t === "time") { const [lo, hi] = xDomain(); return time(hi - lo); }
    return t === "band" ? (v) => String(v ?? "") : (v) => applyPipe("number", v);
  });
  const xFmt = xFormatOf(timeDetail), xTickFmt = xFormatOf(timeFormat);

  // ---- the target state in data space (downsampled) and the state drawn now (animated)
  const maxPoints = computed(() => num(read(props.maxPoints)) ?? Math.max(64, Math.round(box().w * 2)));
  const keyOf = (i: number): string | number => (xType() === "band" ? String(xRaw()[i]) : (xNum()[i] as number));
  const target = computed((): Snap => {
    const [a, b] = range(), xv = xNum(), st = stack(), lim = maxPoints(), out = new Map<string, MSeries>();
    for (const s of visible()) {
      const v = st.get(s.key) as { lo: number[] | null; hi: (number | null)[] };
      const idx: number[] = [];
      for (let i = a; i <= b; i++) if (isFinite(xv[i] as number)) idx.push(i);
      const keep = idx.length > lim && s.type !== "bar" ? downsample(idx, v.hi, xv, lim) : idx;
      out.set(s.key, { key: s.key, axis: s.axis, pts: keep.map((i): MPoint => ({ k: keyOf(i), x: xv[i] as number, y: v.hi[i] ?? null, lo: v.lo ? (v.lo[i] as number) : null })) });
    }
    const yn = yNice(), y2 = y2Nice();
    return { xd: xDomain(), yd: [yn.min, yn.max], y2d: [y2.min, y2.max], series: out, base: clamp(0, yn.min, yn.max), base2: clamp(0, y2.min, y2.max) };
  });
  const trans = signal<{ from: Snap; to: Snap; wave: number } | null>(null);
  const prog = signal<{ d: number; s: (i: number) => number; order: string[] }>({ d: 1, s: () => 1, order: [] });
  let run: { cancel(): void } | null = null;
  const drawn = computed((): Snap => {
    const tr = trans(), p = prog();
    if (!tr) return untrack(target);
    if (p.d >= 1 && p.order.every((_, i) => p.s(i) >= 1)) return tr.to;
    const at = new Map(p.order.map((k, i) => [k, i]));
    return between(tr.from, tr.to, p.d, (k) => p.s(at.get(k) ?? 0), tr.wave);
  });
  effect(() => {
    const to = target(), how = untrack(() => animateOf(props.animate)), prev = untrack(trans);
    const first = !prev;
    const from = first ? { ...to, series: new Map() } : untrack(drawn);
    run?.cancel(); run = null;
    const order = [...new Set([...to.series.keys(), ...from.series.keys()])];
    trans.set({ from, to, wave: first ? 0.45 : 0 });
    run = untrack(() => playMarks(order.length + 1, how, first ? "enter" : "update", (i) => (i ? (order[i - 1] as string) : ""),
      (pr) => prog.set({ d: pr(0), s: (i) => pr(i + 1), order })));
    if (!run) prog.set({ d: 1, s: () => 1, order });
  });
  onCleanup(() => run?.cancel());

  // scales of the drawn state (axes and grid follow the morph)
  const xs = computed(() => scaleLinear(drawn().xd, [0, box().w]));
  const ys = computed(() => scaleLinear(drawn().yd, [box().h, 0]));
  const y2s = computed(() => scaleLinear(drawn().y2d, [box().h, 0]));
  const xTicks = computed((): Tick[] => {
    const s = xs(), f = xTickFmt(), t = xType(), [lo, hi] = xDomain(), w = box().w;
    const make = (n: number): Tick[] => {
      if (t === "time") return timeTicks(lo, hi, n).map((v) => ({ key: v, pos: s(v), label: f(v) }));
      if (t === "linear") return scaleLinear([lo, hi], [0, 1]).ticks(n).map((v) => ({ key: v, pos: s(v), label: f(v) }));
      const [a, b] = range(), raw = xRaw(), idx: number[] = [];
      for (let i = a; i <= b; i++) idx.push(i);
      return thin(idx, n).map((i) => ({ key: String(raw[i]), pos: s(i), label: f(raw[i]) }));
    };
    // as many ticks as fit: long labels ("Oct 14, 2026") get fewer, so they never overlap
    let n = Math.max(2, Math.floor(w / 90)), ticks = make(n);
    for (let k = 0; k < 4 && ticks.length > 2; k++) {
      const widest = Math.max(...ticks.map((x) => textWidth(x.label))) + 16;
      if (widest * ticks.length <= w) break;
      n = Math.max(2, Math.floor(w / widest) - (k ? 1 : 0));
      ticks = make(n);
    }
    return ticks;
  });
  const grid = computed(() => read(props.grid) ?? true);
  const yTicks = computed((): Tick[] => { const s = ys(), f = yFmt(); return stream() ? [] : yNice().ticks.map((v) => ({ key: v, pos: s(v), label: f(v) })); });
  const y2Ticks = computed((): Tick[] => { const s = y2s(), f = y2Fmt(); return hasRight() ? y2Nice().ticks.map((v) => ({ key: v, pos: s(v), label: f(v) })) : []; });
  // horizontal grid lines: on for true / "both", off for "x" (vertical only); a stream has no value axis, but "both"
  // still rules its scale so the thickness of the layers can be compared
  const hTicks = computed((): Tick[] => {
    const g = grid();
    if (!g || g === "x") return [];
    if (!stream()) return yTicks();
    const s = ys();
    return yNice().ticks.map((v) => ({ key: v, pos: s(v), label: "" }));
  });

  // ---- geometry of the drawn state
  const curve = computed((): Curve => read(props.curve) ?? (stream() ? "smooth" : "linear"));
  const layout = computed(() => {
    const d = drawn(), sx = xs(), out = new Map<string, { line: string; area: string; dots: Pt[]; bars: { k: string; x: number; y: number; w: number; h: number }[] }>();
    const all = series(), conn = !!read(props.connectNulls), bs = bars(), slotPx = slot() ? Math.abs(sx(slot()) - sx(0)) : 0;
    const bw = bs.length ? Math.max(1, (slotPx * 0.72) / bs.length) : 0;
    for (const [key, ms] of d.series) {
      const s = all.find((x) => x.key === key);
      if (!s) continue;
      const sy = ms.axis === "right" ? y2s() : ys(), base = sy(ms.axis === "right" ? d.base2 : d.base);
      const top = ms.pts.map((q): Pt | null => (q.y == null ? null : [sx(q.x), sy(q.y)]));
      const cv = s.curve ?? curve();
      if (s.type === "bar") {
        const bi = Math.max(0, bs.findIndex((b) => b.key === key)), off = -((bs.length * bw) / 2) + bi * bw;
        out.set(key, { line: "", area: "", dots: [], bars: ms.pts.filter((q) => q.y != null).map((q) => {
          const x = sx(q.x) + off, y = sy(q.y as number);
          return { k: String(q.k), x: f1(x), y: f1(Math.min(y, base)), w: f1(bw - 1), h: f1(Math.abs(base - y)) };
        }) });
        continue;
      }
      const line = linePath(top, cv, conn);
      const area = s.type === "area" ? areaPath(top, ms.pts.map((q, i) => (top[i] ? [sx(q.x), q.lo != null ? sy(q.lo) : base] as Pt : null)), cv) : "";
      out.set(key, { line, area, dots: top.filter((q): q is Pt => !!q), bars: [] });
    }
    return out;
  });
  const markerOf = (s: XSeries<D>): MarkerShape | null => {
    const m = s.marker ?? read(props.markers);
    if (m === "auto") { const [a, b] = range(); return b - a + 1 <= Math.max(2, box().w / 14) ? "circle" : null; }
    return m === true ? "circle" : m ? m : null;
  };

  // ---- interaction
  const pointAt = (i: number): ChartPoint<D> => {
    const d = rows()[i], vis = visible(), values: Record<string, number | null> = {};
    for (const s of vis) values[s.key] = num(s.get(d as D, i));
    return { index: i, datum: d, x: xRaw()[i], label: xFmt()(xRaw()[i]), values, series: vis[0]?.key ?? null, y: vis[0] ? values[vis[0].key] : null };
  };
  const nearest = (t: number): number => {
    const [a, b] = range(), v = xNum();
    const x = (i: number): number => v[i] as number;
    if (b < a) return -1;
    if (sorted()) {
      let lo = a, hi = b;
      while (lo < hi) { const m = (lo + hi) >> 1; if (x(m) < t) lo = m + 1; else hi = m; }
      return lo > a && Math.abs(x(lo - 1) - t) <= Math.abs(x(lo) - t) ? lo - 1 : lo;
    }
    let best = a;
    for (let i = a; i <= b; i++) if (Math.abs(x(i) - t) < Math.abs(x(best) - t)) best = i;
    return best;
  };
  const syncName = computed(() => read(props.sync) ?? null);
  const yOf = (s: XSeries<D>, i: number): number | null => { const v = stack().get(s.key)?.hi[i]; return v == null ? null : (s.axis === "right" ? y2s() : ys())(v); };
  const show = (i: number, publish = true): void => {
    active.set(i);
    const g = untrack(syncName);
    if (publish && g) syncGroup(g).set(i < 0 ? null : { from: id, x: xType() === "band" ? String(xRaw()[i]) : (xNum()[i] as number) });
    const opt = read(props.tooltip);
    if (i < 0 || opt === false) return void tip.at.set(null);
    const p = pointAt(i), bx = box();
    const top = Math.min(...visible().map((s) => yOf(s, i) ?? bx.h), bx.h);
    const content = typeof opt === "function" ? () => opt(p)
      : () => tipBody(p.label, visible().map((s) => ({ label: s.label, value: (s.axis === "right" ? y2Fmt() : yFmt())(p.values[s.key]), index: s.index })), props.colors);
    showTip(tip, svg, size.width(), bx.x + xs()(xNum()[i] as number), bx.y + top, content);
  };
  const hide = (): void => show(-1);
  // another chart of the sync group moved the crosshair: follow it (no tooltip echo back)
  effect(() => {
    const g = syncName();
    if (!g) return;
    const at = syncGroup(g)();
    untrack(() => {
      if (at?.from === id) return;
      if (!at) { active.set(-1); tip.at.set(null); return; }
      const i = typeof at.x === "string" ? xRaw().findIndex((v) => String(v) === at.x) : nearest(at.x);
      show(i, false);
    });
  });
  const px = (e: PointerEvent): number => localPoint(svg, e, size.width())[0] - box().x;
  const clampX = (p: number): number => clamp(p, 0, box().w);
  const select = (): void => { const i = active.peek(); if (i >= 0) props.onSelect?.(pointAt(i)); };
  const handlers = {
    onPointerDown: (e: PointerEvent) => { if (read(props.zoom)) { const p = clampX(px(e)); drag.set([p, p]); dragged = false; } },
    onPointerMove: (e: PointerEvent) => { const d = drag.peek(); if (d) { drag.set([d[0], clampX(px(e))]); return; } show(nearest(xs().invert(px(e)))); },
    onPointerUp: () => {
      const d = drag.peek();
      if (!d) return;
      drag.set(null);
      if (Math.abs(d[1] - d[0]) < 4) return;
      dragged = true;
      const i0 = nearest(xs().invert(Math.min(...d))), i1 = nearest(xs().invert(Math.max(...d)));
      if (i1 - i0 >= 2) { zoom.set([i0, i1]); hide(); }
    },
    onPointerLeave: () => { if (!drag.peek()) hide(); },
    onClick: () => { if (!dragged) select(); dragged = false; },
    onDblClick: () => { zoom.set(null); hide(); },
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") { if (zoom.peek()) zoom.set(null); return hide(); }
    const [a, b] = range();
    const i = navIndex(e.key, active.peek(), a, b);
    if (i == null || b < a) return;
    e.preventDefault();
    show(i);
  };

  // ---- reference marks
  const marks = RefMarks;
  const scales = {
    box,
    x: (v: unknown): number | null => {
      if (xType() === "band") { const i = xRaw().findIndex((r) => String(r) === String(v)); return i < 0 ? null : xs()(i); }
      const n = xType() === "time" ? timeMs(v) : Number(v);
      return isFinite(n) ? xs()(n) : null;
    },
    xBand: () => (xType() === "band" ? Math.abs(xs()(1) - xs()(0)) : 0),
    y: (v: number, axis: "left" | "right") => (axis === "right" ? y2s() : ys())(v),
    stat: (st: "average" | "median" | "min" | "max", key: string | undefined) => {
      const s = visible().find((x) => x.key === key) ?? visible()[0];
      if (!s) return null;
      const [a, b] = range(), r = rows();
      return statOf(r.slice(a, b + 1).map((d, j) => num(s.get(d, a + j))), st);
    },
    fmtX: (v: unknown) => xFmt()(xType() === "time" ? timeMs(v) : v),
    fmtY: (v: unknown, axis: "left" | "right") => (axis === "right" ? y2Fmt() : yFmt())(v),
  };

  const focusX = attr(() => { const i = active(); return i < 0 ? 0 : f1(box().x + xs()(xNum()[i] as number)); });
  const clipId = `${id}-clip`;
  const shown = computed(() => series().filter((s) => drawn().series.has(s.key)));
  const body = [
    h("defs", {}, h("clipPath", { id: clipId }, h("rect", { x: -2, y: -4, width: attr(() => box().w + 4), height: attr(() => box().h + 8) }))),
    Grid({ dir: "h", ticks: hTicks, box }),
    Grid({ dir: "v", ticks: () => (grid() === "both" || grid() === "x" ? xTicks() : []), box }),
    marks({ marks: props.marks, scales, layer: "back" }),
    () => (stream() ? null : Axis({ side: "left", ticks: yTicks, box, title: () => read(props.yTitle) })),
    () => (hasRight() ? Axis({ side: "right", ticks: y2Ticks, box, title: () => read(props.y2Title) }) : null),
    Axis({ side: "bottom", ticks: xTicks, box, title: () => read(props.xTitle) }),
    h("g", { class: "m-chart-plot", transform: attr(() => `translate(${box().x},${box().y})`), "clip-path": `url(#${clipId})` },
      each<XSeries<D>>({ each: shown, key: (s) => s.key, children: (s) => {
        const key = s().key, geo = attr(() => layout().get(key));
        const mk = attr(() => markerOf(s()));
        return h("g", { class: () => `m-chart-series m-chart-is-${s().type} ${seriesClass(s().index)}`, style: () => colorStyle(props.colors, s().index), "data-series": key },
          () => (s().type === "bar" ? each<{ k: string; x: number; y: number; w: number; h: number }>({ each: () => geo()?.bars ?? [], key: (b) => b.k, children: (b) => h("rect", { class: "m-chart-bar", x: () => b().x, y: () => b().y, width: () => b().w, height: () => b().h, rx: 2 }) })
            : [s().type === "area" ? h("path", { class: "m-chart-area", d: attr(() => geo()?.area ?? "") }) : null,
              h("path", { class: "m-chart-line", d: attr(() => geo()?.line ?? ""), "stroke-dasharray": attr(() => dashOf(s().dash)) }),
              () => (mk() ? h("path", { class: "m-chart-dots", d: attr(() => dotsPath(geo()?.dots ?? [], mk() as MarkerShape)) }) : null)]));
      } })),
    marks({ marks: props.marks, scales, layer: "front" }),
    h("g", { class: "m-chart-focus", visibility: () => (active() >= 0 ? "visible" : "hidden"), transform: () => `translate(${focusX()},${box().y})` },
      h("line", { class: "m-chart-guide", y1: 0, y2: attr(() => box().h) }),
      each<XSeries<D>>({ each: visible, key: (s) => s.key, children: (s) => {
        const cy = attr(() => { const i = active(); const v = i < 0 ? null : yOf(s(), i); return v == null ? null : f1(v); });
        return h("circle", { class: () => `m-chart-marker ${seriesClass(s().index)}`, style: () => colorStyle(props.colors, s().index), r: 4, cx: 0, cy, visibility: () => (cy() == null ? "hidden" : "visible") });
      } })),
    h("rect", { class: "m-chart-brush", visibility: () => (drag() ? "visible" : "hidden"), y: () => box().y, height: () => box().h,
      x: () => box().x + Math.min(...(drag() ?? [0])), width: () => { const d = drag(); return d ? Math.abs(d[1] - d[0]) : 0; } }),
    h("rect", { class: "m-chart-overlay", x: () => box().x, y: () => box().y, width: () => box().w, height: () => box().h, ...handlers }),
  ];

  // ---- range navigator: the whole series small, the shown range as a window
  const navH = computed(() => { const n = read(props.navigator); return n === true ? 48 : typeof n === "number" ? n : 0; });
  const navigator = () => (navH() ? Navigator({
    width: size.width, x: () => box().x, w: () => box().w, height: navH,
    range: () => {
      const n = rows().length, [a, b] = range(), v = xNum();
      if (n < 2 || (a === 0 && b === n - 1)) return null;
      const lo = v[0] as number, span = ((v[n - 1] as number) - lo) || 1;
      return [((v[a] as number) - lo) / span, ((v[b] as number) - lo) / span];
    },
    onRange: (r) => {
      if (!r) return zoom.set(null);
      const v = xNum(), n = v.length, lo = v[0] as number, span = ((v[n - 1] as number) - lo) || 1;
      const i0 = nearestAll(v, lo + r[0] * span), i1 = nearestAll(v, lo + r[1] * span);
      if (i1 > i0) zoom.set([i0, i1]);
    },
    paths: (): NavPath[] => {
      const v = xNum(), n = v.length, st = stack(), w = box().w, hh = navH();
      if (n < 2) return [];
      const sx = scaleLinear([v[0] as number, v[n - 1] as number], [0, w]);
      let lo = Infinity, hi = -Infinity;
      for (const s of visible()) for (const x of st.get(s.key)?.hi ?? []) if (x != null) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
      const sy = scaleLinear([Math.min(lo, 0), hi], [hh - 3, 3]);
      return visible().filter((s) => s.axis === "left").map((s) => {
        const hv = st.get(s.key)?.hi ?? [], idx = downsample(v.map((_, i) => i), hv, v, Math.max(32, Math.round(w)));
        const pts = idx.map((i): Pt | null => (hv[i] == null ? null : [sx(v[i] as number), sy(hv[i] as number)]));
        return { key: s.key, cls: seriesClass(s.index), style: colorStyle(props.colors, s.index), line: linePath(pts), area: areaPath(pts, idx.map((i): Pt => [sx(v[i] as number), sy(Math.max(Math.min(lo, 0), 0))])) };
      });
    },
    valueText: (f) => { const v = xNum(), n = v.length; if (!n) return ""; const lo = v[0] as number; return String(xFmt()(xType() === "band" ? xRaw()[nearestAll(v, lo + f * (((v[n - 1] as number) - lo) || 1))] : lo + f * (((v[n - 1] as number) - lo) || 1))); },
  }) : null);

  const xLabel = (): unknown => read(props.xLabel) ?? (typeof props.x === "string" ? props.x : "x");
  return Frame<D>(props, {
    kind: chartClass ?? (kind === "bar" ? "combo" : kind), size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => rows().length === 0,
    tip,
    legend: { items: () => { const l = read(props.legend); return l === false || (l == null && series().length < 2) ? [] : series(); }, hidden },
    table: {
      caption: () => read(props.title),
      rows,
      // the formats are read here, so a format change rebuilds the table (the cells themselves stay untracked)
      columns: () => { const xf = xFmt(), f = yFmt(), f2 = y2Fmt(); return [{ label: xLabel(), value: (_d: D, i: number) => xf(xRaw.peek()[i]) },
        ...series().map((s) => ({ label: s.label, value: (d: D, i: number) => (s.axis === "right" ? f2 : f)(num(s.get(d, i))) }))]; },
    },
    extra: [navigator, h("button", { type: "button", class: "m-chart-reset", hidden: () => !zoom(), onClick: () => { zoom.set(null); hide(); } }, () => read(props.resetLabel) ?? "Reset zoom")],
  });
}

/** LTTB over the runs of a series (gaps stay gaps): the kept indices. */
function downsample(idx: readonly number[], val: readonly (number | null)[], xv: readonly number[], lim: number): number[] {
  const segs: number[][] = [];
  let cur: number[] = [];
  for (const i of idx) { if (val[i] == null) { if (cur.length) segs.push(cur), (cur = []); } else cur.push(i); }
  if (cur.length) segs.push(cur);
  const total = segs.reduce((n, g) => n + g.length, 0) || 1;
  return segs.flatMap((g) => lttb(g, Math.max(3, Math.round((g.length * lim) / total)), (i) => xv[i] as number, (i) => val[i] as number));
}
const nearestAll = (v: readonly number[], t: number): number => { let best = 0; for (let i = 1; i < v.length; i++) if (Math.abs((v[i] as number) - t) < Math.abs((v[best] as number) - t)) best = i; return best; };

/** One path with a marker at every point (one DOM node however many points). */
function dotsPath(pts: readonly Pt[], shape: MarkerShape, r = 3.5): string {
  return pts.map(([x, y]) => {
    if (shape === "square") return `M${f1(x - r)},${f1(y - r)}h${2 * r}v${2 * r}h${-2 * r}Z`;
    if (shape === "diamond") return `M${f1(x)},${f1(y - r * 1.3)}l${r * 1.3},${r * 1.3}l${-r * 1.3},${r * 1.3}l${-r * 1.3},${-r * 1.3}Z`;
    if (shape === "triangle") return `M${f1(x)},${f1(y - r * 1.2)}l${r * 1.2},${r * 2}h${-r * 2.4}Z`;
    return `M${f1(x - r)},${f1(y)}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0`;
  }).join("");
}
