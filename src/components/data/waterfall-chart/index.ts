// WaterfallChart: how a start value becomes an end value, step by step (march/charts). Folder:
// src/components/data/waterfall-chart/; shared chart parts (scales, axes, tooltip, data table, marks, motion) are in src/charts/.
// Steps are a keyed presence list: every bar floats out of the previous bar's end (`base`), connectors follow the bars,
// a leaving bar shrinks back to where it started before it is removed.
import "./waterfall-chart.css";
import { signal, computed, read, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { scaleLinear, scaleBand, niceTicks } from "../../../charts/scale.ts";
import { rowsOf, accessor, formatter, num, useSize, attr, textWidth, navIndex, sameBox, each, tween, presence, animateOf, colorStyle, f1,
  type AnimateProp, type AnimateOptions, type MotionContext, type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp, type Box } from "../../../charts/util.ts";
import { Frame, Axis, Grid, tooltipState, showTip, tipBody, thin, type Tick } from "../../../charts/parts.ts";
import { RefMarks, statOf, type RefMarksProp } from "../../../charts/marks.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import type { Handler } from "../../../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** "up" (an increase), "down" (a decrease) or "total" (a start, subtotal or total column from zero). */
export type WaterfallKind = "up" | "down" | "total";
/** Point passed to `tooltip(point)`, `labels(point)` and `onSelect(point)` of a waterfall chart. */
export interface WaterfallPoint<D> {
  /** Row index in `data` (-1 for the start and end columns the chart adds). */ index: number;
  /** Place among the columns. */ position: number;
  datum: D | undefined; label: string; kind: WaterfallKind;
  /** The step (or, for a total, the running total). */ value: number;
  /** Running total before and after the column. */ from: number; to: number;
}
export interface WaterfallChartProps<D = unknown> extends ChartBaseProps {
  /** Rows, one step each (or a subtotal row): an array (or signal / function returning one). @tr Satırlar, her biri bir adım (ya da ara toplam satırı): bir dizi (ya da onu döndüren sinyal / fonksiyon). */
  data?: DataProp<D>;
  /** Column label: a key or getter (default "label"). @tr Sütun etiketi: bir anahtar ya da getter (varsayılan "label"). */
  x?: Field<D> | undefined;
  /** The step, positive or negative: a key or getter (default "value"). @tr Adım, artı ya da eksi: bir anahtar ya da getter (varsayılan "value"). */
  y?: Field<D> | undefined;
  /** A start value, drawn as the first column from zero. @tr Başlangıç değeri; sıfırdan çıkan ilk sütun olarak çizilir. */
  start?: Opt<number>;
  /** Label of the start column (default "Start"). @tr Başlangıç sütununun etiketi (varsayılan "Start"). */
  startLabel?: Opt<string>;
  /** Marks subtotal rows: a key or getter that is truthy on them (default "total"); such a row shows the running total. @tr Ara toplam satırlarını işaretler: onlarda doğru olan bir anahtar ya da getter (varsayılan "total"); böyle bir satır o anki toplamı gösterir. */
  total?: Field<D> | undefined;
  /** "end" (or `true`) adds a total column at the end. @tr "end" (ya da `true`) sona bir toplam sütunu ekler. */
  totals?: Opt<"end" | boolean>;
  /** Label of the end total column (default "Total"). @tr Sondaki toplam sütununun etiketi (varsayılan "Total"). */
  totalLabel?: Opt<string>;
  /** Connector lines from each bar's end to the next bar (default true). @tr Her çubuğun ucundan sonrakine bağlantı çizgileri (varsayılan true). */
  connectors?: Opt<boolean>;
  /** Value labels at the bars: `true` (default: +/− for steps), `false`, or `(point) => string`. @tr Çubuklarda değer yazıları: `true` (varsayılan: adımlarda +/−), `false` ya da `(point) => string`. */
  labels?: Opt<boolean> | ((p: WaterfallPoint<D>) => string);
  /** Color of increases: a theme token or CSS color (default the "good" chart token). @tr Artışların rengi: tema belirteci ya da CSS rengi (varsayılan grafik "good" belirteci). */
  upColor?: Opt<string>;
  /** Color of decreases (default the "bad" chart token). @tr Azalışların rengi (varsayılan grafik "bad" belirteci). */
  downColor?: Opt<string>;
  /** Color of start, subtotal and total columns (default neutral). @tr Başlangıç, ara toplam ve toplam sütunlarının rengi (varsayılan nötr). */
  totalColor?: Opt<string>;
  /** Columns on the y axis, bars run to the right. @tr Sütunlar y ekseninde, çubuklar sağa doğru uzar. */
  horizontal?: Opt<boolean>;
  /** "vertical" (default) or "horizontal"; same as `horizontal`. @tr "vertical" (varsayılan) ya da "horizontal"; `horizontal` ile aynı. */
  orientation?: Opt<"vertical" | "horizontal">;
  /** Value format for axis, labels, tooltip and table (default "number"). @tr Eksen, yazılar, araç ipucu ve tablo için değer biçimi (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Fixes the low end of the value axis. @tr Değer ekseninin alt ucunu sabitler. */
  yMin?: Opt<number>;
  /** Fixes the high end of the value axis. @tr Değer ekseninin üst ucunu sabitler. */
  yMax?: Opt<number>;
  /** Grid lines along the value axis (default true). @tr Değer ekseni boyunca ızgara çizgileri (varsayılan true). */
  grid?: Opt<boolean>;
  /** Reference marks (vertical layout): target lines `{ y }`, bands `{ y: [a, b] }`, statistics of the running total `{ y: "average" }`, column marks `{ x }`. @tr Referans işaretleri (dikey düzen): hedef çizgileri `{ y }`, bantlar `{ y: [a, b] }`, ara toplamların istatistikleri `{ y: "average" }`, sütun işaretleri `{ x }`. */
  marks?: RefMarksProp;
  /** Header of the label column in the data table (default "Step"). @tr Veri tablosundaki etiket sütununun başlığı (varsayılan "Step"). */
  xLabel?: Opt<string>;
  /** Header of the change column in the data table (default "Change"). @tr Veri tablosundaki değişim sütununun başlığı (varsayılan "Change"). */
  yLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<WaterfallPoint<D>>;
  /** Called with the column on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki sütunda Enter / Space'e basılınca sütunla çağrılır. */
  onSelect?: Handler<[p: WaterfallPoint<D>]> | undefined;
  /** Motion: bars build one after another (each floats from the previous end), morph on change, connectors follow, leaving bars shrink. `true` (default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. @tr Hareket: çubuklar sırayla kurulur (her biri öncekinin ucundan çıkar), değişince biçim değiştirir, bağlantılar izler, çıkan çubuklar küçülür. `true` (varsayılan), `false`, bir easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da `(ctx) => …`. */
  animate?: MaybeReactive<AnimateProp>;
}

interface Step<D> { key: string; label: string; index: number; position: number; kind: WaterfallKind; value: number; from: number; to: number; datum: D | undefined }
interface Geo { x: number; y: number; width: number; height: number; base: number }
interface Link { key: string; position: number; x1: number; x2: number; y: number }
const KINDS: readonly WaterfallKind[] = ["up", "down", "total"];
const ZERO: Geo = { x: 0, y: 0, width: 0, height: 0, base: 0 };

const NAMED: Record<string, string> = { good: "var(--m-chart-good)", bad: "var(--m-chart-bad)", neutral: "var(--m-waterfall-total)" };
/** A theme token ("success", "brand-blue", "--my-var") or a CSS color as a CSS value. */
const tok = (c: string): string => NAMED[c] ?? (c.startsWith("--") ? `var(${c})` : /^[a-z]+(-[a-z0-9]+)*$/.test(c) && !/^(white|black|red|green|blue|orange|purple|gray|grey|transparent|gold|pink|teal|navy)$/.test(c) ? `var(--m-${c})` : c);
/** Build: bar after bar on the first draw, then a plain spring. */
const BUILD = (c: MotionContext): AnimateOptions | boolean => (c.phase === "enter" ? { stagger: 110 } : true);

/** Waterfall chart. See docs.md for props. */
export function WaterfallChart<D>(props: WaterfallChartProps<D>): Element {
  const size = useSize(props, 640, 280);
  const hidden = signal(new Set<string>()), active = signal(-1);
  const tip = tooltipState();
  let svg: Element | null = null;
  const how = (): AnimateProp => { const a = animateOf(props.animate as AnimateProp); return a === undefined || a === true ? BUILD : a; };

  const horizontal = computed(() => !!read(props.horizontal) || read(props.orientation) === "horizontal");
  const rows = computed(() => rowsOf(props.data));
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  // the three kinds' colors (up, down, total): the color props, else `colors`; legend, tooltip and bars read them
  const kindColors = computed(() => { const c = read(props.colors) ?? [];
    return [read(props.upColor) ?? c[0], read(props.downColor) ?? c[1], read(props.totalColor) ?? c[2]].map((x) => (x ? tok(String(x)) : "")); });

  const steps = computed((): Step<D>[] => {
    const lab = accessor<D>(props.x ?? "label"), val = accessor<D>(props.y ?? "value"), isTotal = accessor<D>(props.total ?? "total");
    const out: Step<D>[] = [], seen = new Set<string>();
    const add = (s: Omit<Step<D>, "key" | "position">): void => {
      let key = s.label;
      for (let n = 2; seen.has(key); n++) key = `${s.label}#${n}`;
      seen.add(key);
      out.push({ ...s, key, position: out.length });
    };
    let run = 0;
    const s0 = num(read(props.start));
    if (s0 != null) { add({ label: read(props.startLabel) ?? t`Start`, index: -1, kind: "total", value: s0, from: 0, to: s0, datum: undefined }); run = s0; }
    rows().forEach((d, i) => {
      const label = String(lab(d, i) ?? "");
      if (isTotal(d, i)) return add({ label, index: i, kind: "total", value: run, from: 0, to: run, datum: d });
      const v = num(val(d, i)) ?? 0;
      add({ label, index: i, kind: v < 0 ? "down" : "up", value: v, from: run, to: run + v, datum: d });
      run += v;
    });
    const end = read(props.totals);
    if ((end === true || end === "end") && rows().length) add({ label: read(props.totalLabel) ?? t`Total`, index: -1, kind: "total", value: run, from: 0, to: run, datum: undefined });
    return out;
  });
  const shown = computed(() => steps().filter((s) => !hidden().has(s.kind)));
  const pres = presence(shown, (s) => s.key, how);

  const nice = computed(() => {
    let lo = 0, hi = 0;
    for (const s of steps()) { lo = Math.min(lo, s.from, s.to); hi = Math.max(hi, s.from, s.to); }
    const len = horizontal() ? size.width() - 120 : size.height() - 40;
    return niceTicks(num(read(props.yMin)) ?? lo, num(read(props.yMax)) ?? hi, Math.max(2, Math.floor(len / (horizontal() ? 90 : 40))));
  });
  const box = computed((): Box => {
    const f = fmt(), top = labelOff() ? 12 : 22, r = 16;
    if (horizontal()) {
      const ml = Math.min(160, Math.max(40, 12 + Math.max(0, ...steps().map((s) => textWidth(s.label)))));
      return { x: ml, y: 8, w: Math.max(10, size.width() - ml - r - 40), h: Math.max(10, size.height() - 8 - 28) };
    }
    const ml = Math.min(120, Math.max(32, 12 + Math.max(0, ...nice().ticks.map((v) => textWidth(f(v))))));
    return { x: ml, y: top, w: Math.max(10, size.width() - ml - r), h: Math.max(10, size.height() - top - 28) };
  }, { equals: sameBox });
  const vs = computed(() => { const b = box(); return scaleLinear([nice().min, nice().max], horizontal() ? [0, b.w] : [b.h, 0]); });
  const band = computed(() => { const b = box(); return scaleBand(steps().map((s) => s.key), [0, horizontal() ? b.h : b.w], { paddingInner: 0.28, paddingOuter: 0.14 }); });

  const layout = computed(() => {
    const out = new Map<string, Geo>(), v = vs(), bs = band(), hz = horizontal();
    for (const s of steps()) {
      const p0 = v(s.from), p1 = v(s.to), lo = Math.min(p0, p1), len = Math.abs(p1 - p0), at = bs(s.key);
      out.set(s.key, hz ? { x: lo, y: at, width: len, height: bs.bandwidth, base: p0 } : { x: at, y: lo, width: bs.bandwidth, height: len, base: p0 });
    }
    return out;
  });
  const links = computed((): Link[] => {
    if (read(props.connectors) === false) return [];
    const list = shown(), v = vs(), bs = band(), out: Link[] = [];
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i] as Step<D>, b = list[i + 1] as Step<D>;
      out.push({ key: b.key, position: b.position, x1: bs(a.key) + bs.bandwidth, x2: bs(b.key), y: v(a.to) });
    }
    return out;
  });

  const catTicks = computed((): Tick[] => {
    const bs = band(), list = steps(), len = horizontal() ? box().h / 22 : box().w / 64;
    return thin(list, Math.max(2, Math.floor(len))).map((s) => ({ key: s.key, pos: f1(bs.center(s.key)), label: s.label }));
  });
  const valTicks = computed((): Tick[] => { const s = vs(), f = fmt(); return nice().ticks.map((v) => ({ key: v, pos: f1(s(v)), label: f(v) })); });

  const pointAt = (s: Step<D> | undefined): WaterfallPoint<D> | undefined => s && { index: s.index, position: s.position, datum: s.datum, label: s.label, kind: s.kind, value: s.value, from: s.from, to: s.to };
  const kindName = (k: WaterfallKind): string => (k === "up" ? t`Increase` : k === "down" ? t`Decrease` : t`Total`);
  const signed = (s: Step<D>): string => (s.kind === "total" ? String(fmt()(s.value)) : `${s.value < 0 ? "−" : "+"}${fmt()(Math.abs(s.value))}`);
  const labelOff = (): boolean => !(typeof props.labels === "function" && props.labels.length) && read(props.labels as Opt<boolean>) === false;
  const labelOf = (s: Step<D>): string => {
    const l = props.labels;
    if (typeof l === "function" && l.length) return (l as (p: WaterfallPoint<D>) => string)(pointAt(s) as WaterfallPoint<D>);
    return read(l as Opt<boolean>) === false ? "" : signed(s);
  };

  const show = (k: number): void => {
    active.set(k);
    const opt = read(props.tooltip), s = shown()[k], g = s && layout().get(s.key);
    if (!s || !g || opt === false) return void tip.at.set(null);
    const b = box(), p = pointAt(s) as WaterfallPoint<D>, ki = KINDS.indexOf(s.kind);
    const content = typeof opt === "function" ? () => opt(p) : () => tipBody(s.label, [
      { label: kindName(s.kind), value: signed(s), index: ki },
      ...(s.kind === "total" ? [] : [{ label: t`Running total`, value: fmt()(s.to), index: 2 }]),
    ], kindColors);
    if (horizontal()) showTip(tip, svg, size.width(), b.x + g.x + g.width, b.y + g.y + g.height / 2, content);
    else showTip(tip, svg, size.width(), b.x + g.x + g.width / 2, b.y + g.y, content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const select = (k = active.peek()): void => { const p = pointAt(shown()[k]); if (p) props.onSelect?.(p); };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const k = navIndex(e.key, active.peek(), 0, shown().length - 1);
    if (k == null || !shown().length) return;
    e.preventDefault();
    show(k);
  };
  const activeKey = (): string | undefined => shown()[active()]?.key;

  const scales = {
    box, xBand: () => band().bandwidth,
    x: (v: unknown): number | null => { const s = steps().find((x) => x.label === String(v) || x.key === String(v)); return s ? band().center(s.key) : null; },
    y: (v: number): number | null => vs()(v),
    stat: (st: "average" | "median" | "min" | "max"): number | null => statOf(steps().map((s) => s.to), st),
    fmtX: (v: unknown): unknown => String(v), fmtY: (v: unknown): unknown => fmt()(v),
  };
  const last = new Map<string, Geo>();
  const hz = untrack(horizontal);
  const body = [
    Grid({ dir: hz ? "v" : "h", ticks: () => (read(props.grid) ?? true ? valTicks() : []), box }),
    hz ? null : RefMarks({ marks: props.marks, scales, layer: "back" }),
    Axis({ side: hz ? "bottom" : "left", ticks: valTicks, box }),
    Axis({ side: hz ? "left" : "bottom", ticks: catTicks, box }),
    h("g", { class: "m-chart-plot", transform: attr(() => `translate(${box().x},${box().y})`), onPointerLeave: hide },
      h("g", { class: "m-waterfall-links", "aria-hidden": "true" },
        each<Link>({ each: links, key: (l) => l.key, children: (l) => {
          const g = tween(l, ["x1", "x2", "y"], how, (to) => ({ ...to, x2: to.x1 }), { index: () => l().position, key: untrack(l).key });
          return h("line", { class: "m-waterfall-link", ...(hz
            ? { y1: attr(() => f1(g().x1)), y2: attr(() => f1(g().x2)), x1: attr(() => f1(g().y)), x2: attr(() => f1(g().y)) }
            : { x1: attr(() => f1(g().x1)), x2: attr(() => f1(g().x2)), y1: attr(() => f1(g().y)), y2: attr(() => f1(g().y)) }) });
        } })),
      each<Step<D> & { leaving?: boolean }>({ each: pres.items, key: (s) => s.key, children: (s) => {
        const key = untrack(s).key;
        const target = (): Geo => {
          const st = s(), now = st.leaving ? undefined : layout().get(st.key);
          if (now) { last.set(st.key, now); return now; }
          const l = last.get(st.key) ?? ZERO;
          return untrack(horizontal) ? { ...l, x: l.base, width: 0 } : { ...l, y: l.base, height: 0 };
        };
        // a new bar floats out of the previous bar's end: zero length at its own start level
        const g = tween(target, ["x", "y", "width", "height", "base"], how, (to) => (untrack(horizontal) ? { ...to, x: to.base, width: 0 } : { ...to, y: to.base, height: 0 }),
          { index: () => s().position, key, leaving: () => !!s().leaving, onSettle: () => { if (untrack(s).leaving) { last.delete(key); pres.done(key); } } });
        const neg = (): boolean => s().to < s().from || (s().kind === "total" && s().to < 0);
        // a horizontal decrease is labelled on its left, unless it would run into the category labels
        const left = (): boolean => neg() && g().x > textWidth(labelOf(s())) + 8;
        const k = (): number => shown().findIndex((x) => x.key === key);
        return h("g", { class: () => `m-waterfall-step m-waterfall-${s().kind}`, "class:m-waterfall-leaving": () => !!s().leaving,
          "class:m-chart-active": () => activeKey() === key, style: () => colorStyle(kindColors, KINDS.indexOf(s().kind)),
          onPointerEnter: () => { if (k() >= 0) show(k()); }, onClick: () => { if (k() >= 0) select(k()); } },
        h("rect", { class: "m-waterfall-bar", x: attr(() => f1(g().x)), y: attr(() => f1(g().y)), width: attr(() => f1(Math.max(0, g().width))), height: attr(() => f1(Math.max(0, g().height))) }),
        h("text", { class: "m-waterfall-label", ...(hz
          ? { x: attr(() => f1(left() ? g().x - 6 : g().x + g().width + 6)), y: attr(() => f1(g().y + g().height / 2)), "dominant-baseline": "central", "text-anchor": () => (left() ? "end" : "start") }
          : { x: attr(() => f1(g().x + g().width / 2)), y: attr(() => f1(neg() ? g().y + g().height + 13 : g().y - 6)), "text-anchor": "middle" }) }, () => labelOf(s())));
      } })),
    hz ? null : RefMarks({ marks: props.marks, scales, layer: "front" }),
  ];

  const frameProps = Object.create(props, { colors: { get: () => kindColors } }) as ChartBaseProps;
  return Frame<Step<D>>(frameProps, {
    kind: "waterfall", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => steps().length === 0, tip,
    legend: { items: () => (read(props.legend) ? KINDS.filter((k) => steps().some((s) => s.kind === k)).map((k) => ({ key: k, label: kindName(k), index: KINDS.indexOf(k) })) : []), hidden },
    table: {
      caption: () => read(props.title), rows: steps,
      columns: () => [{ label: read(props.xLabel) ?? t`Step`, value: (s: Step<D>) => s.label },
        { label: read(props.yLabel) ?? t`Change`, value: (s: Step<D>) => (s.kind === "total" ? "" : signed(s)) },
        { label: t`Running total`, value: (s: Step<D>) => fmt()(s.to) }],
    },
  });
}
