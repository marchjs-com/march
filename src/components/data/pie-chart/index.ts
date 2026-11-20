// PieChart: pie or donut with focusable slices (march/charts). Folder: src/components/data/pie-chart/; shared chart parts (scales, axes, tooltip, data table,
// formats) are in src/charts/.
// PieChart (and donut): one slice per row, `x` = label key, `y` = value key. Slices are keyed by label.
import "./pie-chart.css";
import { signal, computed, read } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, useSize, attr, navIndex, each, tween,
  type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp } from "../../../charts/util.ts";
import { Frame, tooltipState, showTip, tipBody } from "../../../charts/parts.ts";
import { clamp } from "../../../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** Point passed to `tooltip(point)` and `onSelect(point)` of a pie chart. */
export interface PiePoint<D> { index: number; datum: D; label: string; x: string; y: number; value: number; share: number }
export interface PieChartProps<D = unknown> extends ChartBaseProps {
  /** Rows: an array (or signal / function returning one) of objects. @tr Satırlar: nesnelerden oluşan bir dizi (ya da onu döndüren sinyal / fonksiyon). */
  data?: DataProp<D>;
  /** Slice label: a key or getter (default "label"). @tr Dilim etiketi: bir anahtar ya da getter (varsayılan "label"). */
  x?: Field<D> | undefined;
  /** Slice value: a key or getter (default "value"); negative values count as 0. @tr Dilim değeri: bir anahtar ya da getter (varsayılan "value"); negatif değerler 0 sayılır. */
  y?: Field<D> | readonly Field<D>[] | undefined;
  /** Value format for axis, tooltip and table: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Eksen, araç ipucu ve tablo için değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** `true` for a ring (inner radius 60 %) or an inner radius ratio 0..0.95. @tr Halka için `true` (iç yarıçap %60) ya da 0..0.95 arası bir iç yarıçap oranı. */
  donut?: Opt<boolean | number>;
  /** Gap between slices in radians (default 0.01). @tr Dilimler arasındaki boşluk, radyan cinsinden (varsayılan 0.01). */
  padAngle?: Opt<number>;
  /** Content in the donut hole (default the formatted total). @tr Halkanın ortasındaki içerik (varsayılan biçimlenmiş toplam). */
  center?: Opt<unknown>;
  /** Header of the label column in the data table (default "Label"). @tr Veri tablosundaki etiket sütununun başlığı (varsayılan "Label"). */
  xLabel?: Opt<string>;
  /** Header of the value column in the data table (default "Value"). @tr Veri tablosundaki değer sütununun başlığı (varsayılan "Value"). */
  yLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<PiePoint<D>>;
  /** Called with the point on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki öğede Enter / Space'e basılınca noktayla çağrılır. */
  onSelect?: ((p: PiePoint<D>) => void) | undefined;
  /** When the data changes the slices turn to their new angles (a new one opens from its edge): `true` (a spring) or an easing name ("spring-wobbly", "out"…); default off. @tr Veri değişince dilimler yeni açılarına döner (yeni dilim kenarından açılır): `true` (yay) ya da bir easing adı ("spring-wobbly", "out"…); varsayılan kapalı. */
  animate?: Opt<boolean | string>;
}
/** One slice of `pieLayout`. */
export interface PieSlice { start: number; end: number; value: number; share: number }
interface PieItem<D> { key: string; label: string; index: number; value: number; datum: D }
type Slice<D> = PieItem<D> & PieSlice & { d: string };

const TAU = Math.PI * 2;
const f2 = (v: number): number => Math.round(v * 100) / 100;

/** Angles (radians, clockwise from 12 o'clock) for non-negative values. Returns [{start, end, value, share}]. */
export function pieLayout(values: readonly unknown[], { padAngle = 0 }: { padAngle?: number } = {}): PieSlice[] {
  const vals = values.map((v) => Math.max(0, num(v) ?? 0));
  const total = vals.reduce((a, b) => a + b, 0);
  let a = 0;
  return vals.map((value) => {
    const share = total ? value / total : 0, start = a, end = (a += share * TAU);
    const pad = Math.min(padAngle, (end - start) / 2);
    return { start: start + (share < 1 ? pad / 2 : 0), end: end - (share < 1 ? pad / 2 : 0), value, share };
  });
}

/** SVG path for an annular sector (r0 = 0 for a pie slice). */
export function arcPath(cx: number, cy: number, r: number, r0: number, a0: number, a1: number): string {
  const pt = (rad: number, a: number): string => `${f2(cx + rad * Math.sin(a))},${f2(cy - rad * Math.cos(a))}`;
  if (a1 - a0 >= TAU - 1e-9) { // full circle: two half arcs
    const ring = (rad: number, sweep: number): string => `M${pt(rad, 0)}A${rad},${rad} 0 1 ${sweep} ${pt(rad, Math.PI)}A${rad},${rad} 0 1 ${sweep} ${pt(rad, 0)}Z`;
    return ring(r, 1) + (r0 > 0 ? ring(r0, 0) : "");
  }
  if (a1 <= a0) return "";
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const outer = `M${pt(r, a0)}A${r},${r} 0 ${large} 1 ${pt(r, a1)}`;
  return r0 > 0 ? `${outer}L${pt(r0, a1)}A${r0},${r0} 0 ${large} 0 ${pt(r0, a0)}Z` : `${outer}L${f2(cx)},${f2(cy)}Z`;
}

/** Pie / donut chart. See docs/charts.md for props. */
export function PieChart<D>(props: PieChartProps<D>): Element {
  const size = useSize(props, 320, 240);
  const hidden = signal(new Set<string>()), active = signal(-1);
  const tip = tooltipState();
  let svg: Element | null = null;

  const rows = computed(() => rowsOf(props.data));
  const label = computed(() => accessor<D>(props.x ?? "label"));
  const value = computed(() => accessor<D>(Array.isArray(props.y) ? (props.y as readonly Field<D>[])[0] : (props.y as Field<D> | undefined) ?? "value"));
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const items = computed((): PieItem<D>[] => { const l = label(), v = value(); return rows().map((d, i) => ({ key: String(l(d, i)), label: String(l(d, i)), index: i, value: num(v(d, i)) ?? 0, datum: d })); });
  const shown = computed(() => items().filter((s) => !hidden().has(s.key)));
  const total = computed(() => shown().reduce((a, s) => a + Math.max(0, s.value), 0));
  const geo = computed(() => {
    const w = size.width(), hh = size.height(), r = Math.max(4, Math.min(w, hh) / 2 - 8);
    const d = read(props.donut), ratio = d === true ? 0.6 : num(d) ?? 0;
    return { cx: w / 2, cy: hh / 2, r, r0: r * clamp(ratio, 0, 0.95) };
  });
  const slices = computed((): Slice<D>[] => {
    const list = shown(), lay = pieLayout(list.map((s) => s.value), { padAngle: num(read(props.padAngle)) ?? (list.length > 1 ? 0.01 : 0) });
    const g = geo();
    return list.map((s, i) => { const l = lay[i] as PieSlice; return { ...s, ...l, d: arcPath(g.cx, g.cy, g.r, g.r0, l.start, l.end) }; });
  });

  const pointAt = (k: number): PiePoint<D> | undefined => { const s = slices()[k]; return s && { index: s.index, datum: s.datum, label: s.label, x: s.label, y: s.value, value: s.value, share: s.share }; };
  const show = (k: number): void => {
    active.set(k);
    const opt = read(props.tooltip), s = slices()[k];
    if (!s || opt === false) return void tip.at.set(null);
    const g = geo(), mid = (s.start + s.end) / 2, rr = (g.r + g.r0) / 2 || g.r / 2;
    const content = typeof opt === "function" ? () => opt(pointAt(k) as PiePoint<D>)
      : () => tipBody(s.label, [{ label: applyPipe("percent", s.share, 1), value: fmt()(s.value), index: s.index }], props.colors);
    showTip(tip, svg, size.width(), g.cx + rr * Math.sin(mid), g.cy - rr * Math.cos(mid), content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const select = (k = active.peek()): void => { const p = pointAt(k); if (p) props.onSelect?.(p); };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const k = navIndex(e.key, active.peek(), 0, slices().length - 1);
    if (k == null || !slices().length) return;
    e.preventDefault();
    show(k);
  };
  const activeKey = (): string | undefined => slices()[active()]?.key;

  const body = [
    h("g", { class: "m-chart-plot", onPointerLeave: hide },
      each<Slice<D>>({ each: slices, key: (s) => s.key, children: (s) => { const a = tween(s, ["start", "end"], () => read(props.animate), (to) => ({ ...to, end: to.start })); return h("path", {
        class: () => `m-chart-slice ${seriesClass(s().index)}`, "class:m-chart-active": () => activeKey() === s().key,
        style: () => colorStyle(props.colors, s().index), d: attr(() => { const t = a(), g = geo(); return t.start === s().start && t.end === s().end ? s().d : arcPath(g.cx, g.cy, g.r, g.r0, t.start, Math.max(t.start, t.end)); }),
        onPointerEnter: () => show(slices().findIndex((x) => x.key === s().key)),
        onClick: () => select(slices().findIndex((x) => x.key === s().key)),
      }); } })),
    () => (geo().r0 > 0 ? h("text", { class: "m-chart-center", x: () => geo().cx, y: () => geo().cy, "text-anchor": "middle", "dominant-baseline": "middle" },
      () => { const c = read(props.center); return c ?? fmt()(total()); }) : null),
  ];

  return Frame<D>(props, {
    kind: "pie", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => total() === 0 && hidden().size === 0, tip,
    legend: { items: () => (read(props.legend) === false ? [] : items()), hidden },
    table: {
      caption: () => read(props.title), rows,
      columns: () => [{ label: read(props.xLabel) ?? "Label", value: (d: D, i: number) => label()(d, i) },
        { label: read(props.yLabel) ?? "Value", value: (d: D, i: number) => fmt()(num(value()(d, i))) }],
    },
  });
}
