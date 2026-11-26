// PieChart: pie or donut with focusable slices (march/charts). Folder: src/components/data/pie-chart/; shared chart parts (scales, axes, tooltip, data table,
// formats) are in src/charts/.
// PieChart (and donut): one slice per row, `x` = label key, `y` = value key. Slices are keyed by label.
import "./pie-chart.css";
import { signal, computed, read, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, useSize, attr, navIndex, each, tween, presence, animateOf, type AnimateProp, type Present,
  type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp } from "../../../charts/util.ts";
import { Frame, tooltipState, showTip, tipBody } from "../../../charts/parts.ts";
import { clamp, type Handler } from "../../../core/util.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import { arcPath, TAU } from "../../../charts/arc.ts";

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
  onSelect?: Handler<[p: PiePoint<D>]> | undefined;
  /** Change animations: slices open from their edge (one after another with `stagger`), turn to new angles and close when they leave. `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. @tr Değişim animasyonları: dilimler kenarlarından açılır (`stagger` ile sırayla), yeni açılarına döner ve ayrılırken kapanır. `true` (varsayılan, yay), `false`, bir easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da `(ctx) => …`. */
  animate?: AnimateProp | (() => AnimateProp);
  /** Text on the slices: "percent", "value", "label", `true` (= "percent") or `false` (default); thin slices stay bare. @tr Dilimlerin üstündeki yazı: "percent", "value", "label", `true` (= "percent") ya da `false` (varsayılan); ince dilimler yazısız kalır. */
  labels?: Opt<boolean | "percent" | "value" | "label">;
  /** The active (hovered / focused) slice moves out by this many px (default 6; 0 keeps it in place). @tr Etkin (üstüne gelinen / odaktaki) dilim bu kadar px dışarı çıkar (varsayılan 6; 0 yerinde tutar). */
  pop?: Opt<number>;
}
/** One slice of `pieLayout`. */
export interface PieSlice { start: number; end: number; value: number; share: number }
interface PieItem<D> { key: string; label: string; index: number; value: number; datum: D }
type Slice<D> = PieItem<D> & PieSlice & { d: string };

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

// arcPath lives in src/charts/arc.ts (shared by the round charts); exported here as before
export { arcPath };

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
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const k = navIndex(e.key, active.peek(), 0, slices().length - 1);
    if (k == null || !slices().length) return;
    e.preventDefault();
    show(k);
  };
  const activeKey = (): string | undefined => slices()[active()]?.key;
  const how = (): AnimateProp => animateOf(props.animate);
  const live = presence(slices, (x) => x.key, how);
  const labelMode = computed(() => { const l = read(props.labels); return l === true ? "percent" : l || null; });

  const body = [
    h("g", { class: "m-chart-plot", onPointerLeave: hide },
      each<Present<Slice<D>>>({ each: live.items, key: (s) => s.key, children: (s) => {
        const key = untrack(s).key;
        // a leaving slice closes onto its middle; a new one opens from its start edge
        const a = tween(() => { const t = s(); if (!t.leaving) return t; const mid = (t.start + t.end) / 2; return { ...t, start: mid, end: mid }; }, ["start", "end"], how, (to) => ({ ...to, end: to.start }),
          { index: () => s().index, key, leaving: () => !!s().leaving, onSettle: () => { if (s().leaving) live.done(key); } });
        const mid = (): number => { const t = a(); return (t.start + t.end) / 2; };
        const out = (): number => (activeKey() === key ? num(read(props.pop)) ?? 6 : 0);
        return h("g", { class: "m-chart-slice-g", style: () => { const o = out(); return { transform: o ? `translate(${f2(o * Math.sin(mid()))}px,${f2(-o * Math.cos(mid()))}px)` : "" }; } },
          h("path", {
            class: () => `m-chart-slice ${seriesClass(s().index)}`, "class:m-chart-active": () => activeKey() === key, "class:m-chart-leaving": () => !!s().leaving,
            style: () => colorStyle(props.colors, s().index), d: attr(() => { const t = a(), g = geo(); return t.start === s().start && t.end === s().end && !s().leaving ? s().d : arcPath(g.cx, g.cy, g.r, g.r0, t.start, Math.max(t.start, t.end)); }),
            onPointerEnter: () => show(slices().findIndex((x) => x.key === key)),
            onClick: () => select(slices().findIndex((x) => x.key === key)),
          }),
          () => {
            const m = labelMode();
            if (!m || s().leaving) return null;
            const at = attr(() => { const t = a(), g = geo(), r = g.r0 > 0 ? (g.r + g.r0) / 2 : g.r * 0.62, m2 = (t.start + t.end) / 2; return { x: f2(g.cx + r * Math.sin(m2)), y: f2(g.cy - r * Math.cos(m2)), wide: t.end - t.start > 0.32 }; });
            return h("text", { class: "m-chart-slice-label", x: () => at().x, y: () => at().y, "text-anchor": "middle", "dominant-baseline": "middle", visibility: () => (at().wide ? "visible" : "hidden") },
              () => { const t = s(); return m === "value" ? String(fmt()(t.value)) : m === "label" ? t.label : String(applyPipe("percent", t.share, 0)); });
          });
      } })),
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
