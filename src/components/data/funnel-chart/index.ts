// FunnelChart: stages that narrow as a flow loses people (march/charts). Folder: src/components/data/funnel-chart/;
// shared chart parts (sizing, tooltip, legend, data table, motion) are in src/charts/.
// Stages are a keyed presence list (by label): each one is drawn from flow coordinates (a0..a1 along the flow, half
// widths w0 / w1 across it) that tween, so a stage pours in, morphs to new widths and collapses when it leaves.
import "./funnel-chart.css";
import { signal, computed, read, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { t } from "../../../core/i18n.ts";
import { rowsOf, accessor, formatter, num, seriesClass, useSize, attr, textWidth, navIndex, sameBox, each, tween, presence, animateOf, f1,
  type AnimateProp, type AnimateOptions, type MotionContext, type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp, type Box } from "../../../charts/util.ts";
import { Frame, tooltipState, showTip, tipBody } from "../../../charts/parts.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import type { Handler } from "../../../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** Point passed to `tooltip(point)`, `label(point)` and `onSelect(point)` of a funnel chart. */
export interface FunnelPoint<D> {
  /** Row index in `data`. */ index: number;
  /** Place among the shown stages. */ position: number;
  datum: D; label: string; value: number;
  /** Share of the first shown stage (0..1). */ share: number;
  /** Step conversion: value / previous stage (null for the first). */ conversion: number | null;
  /** Lost since the previous stage (null for the first). */ dropoff: number | null;
}
export type FunnelShape = "funnel" | "bars" | "pyramid";
export interface FunnelChartProps<D = unknown> extends ChartBaseProps {
  /** Rows, one per stage in flow order: an array (or signal / function returning one). @tr Satırlar, akış sırasıyla her aşamaya bir tane: bir dizi (ya da onu döndüren sinyal / fonksiyon). */
  data?: DataProp<D>;
  /** Stage name: a key or getter (default "label"). @tr Aşama adı: bir anahtar ya da getter (varsayılan "label"). */
  x?: Field<D> | undefined;
  /** Stage value: a key or getter (default "value"). @tr Aşama değeri: bir anahtar ya da getter (varsayılan "value"). */
  y?: Field<D> | undefined;
  /** "funnel" (default: smooth trapezoids with curved sides), "bars" (centered bars) or "pyramid" (a triangle, the first stage at its base). @tr "funnel" (varsayılan: kavisli kenarlı yumuşak yamuklar), "bars" (ortalanmış çubuklar) ya da "pyramid" (üçgen; ilk aşama tabanda). */
  shape?: Opt<FunnelShape>;
  /** "vertical" (default: stages top to bottom) or "horizontal" (left to right). @tr "vertical" (varsayılan: aşamalar yukarıdan aşağı) ya da "horizontal" (soldan sağa). */
  orientation?: Opt<"vertical" | "horizontal">;
  /** Space between stages in px (default 6). @tr Aşamalar arası boşluk, px (varsayılan 6). */
  gap?: Opt<number>;
  /** Stage names beside the shape (default true). @tr Aşama adları şeklin yanında (varsayılan true). */
  names?: Opt<boolean>;
  /** The value inside each stage (default true). @tr Her aşamanın içinde değeri (varsayılan true). */
  showValue?: Opt<boolean>;
  /** The share of the first stage inside each stage (default true). @tr Her aşamanın içinde ilk aşamaya göre payı (varsayılan true). */
  showShare?: Opt<boolean>;
  /** The step conversion between stages (default true). @tr Aşamalar arasında adım dönüşümü (varsayılan true). */
  showConversion?: Opt<boolean>;
  /** The drop-off between stages: the lost count, and on bars a faint ghost of the previous stage (default true). @tr Aşamalar arasındaki kayıp: kaybedilen sayı, çubuklarda bir önceki aşamanın soluk gölgesi (varsayılan true). */
  dropoff?: Opt<boolean>;
  /** Replaces the text inside a stage: `(point) => string` (an empty string hides it). @tr Aşamanın içindeki yazının yerine geçer: `(point) => string` (boş metin gizler). */
  label?: ((p: FunnelPoint<D>) => string) | undefined;
  /** Value format: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Format of the share of the first stage (default percent). @tr İlk aşamaya göre payın biçimi (varsayılan yüzde). */
  shareFormat?: Opt<FormatSpec>;
  /** Format of the step conversion (default percent with one decimal). @tr Adım dönüşümünün biçimi (varsayılan bir ondalıklı yüzde). */
  conversionFormat?: Opt<FormatSpec>;
  /** One hue for every stage, fading stage by stage: a theme token ("primary", "brand-blue", "cat-3"…) or a CSS color; without it each stage takes a palette color. @tr Bütün aşamalar için tek renk, aşama aşama solar: tema belirteci ("primary", "brand-blue", "cat-3"…) ya da CSS rengi; verilmezse her aşama paletten bir renk alır. */
  color?: Opt<string>;
  /** Header of the stage column in the data table (default "Stage"). @tr Veri tablosundaki aşama sütununun başlığı (varsayılan "Stage"). */
  xLabel?: Opt<string>;
  /** Header of the value column in the data table (default "Value"). @tr Veri tablosundaki değer sütununun başlığı (varsayılan "Value"). */
  yLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<FunnelPoint<D>>;
  /** Called with the stage on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki aşamada Enter / Space'e basılınca aşamayla çağrılır. */
  onSelect?: Handler<[p: FunnelPoint<D>]> | undefined;
  /** Motion: stages pour in one after another, widths morph on change, leaving stages collapse. `true` (default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. @tr Hareket: aşamalar sırayla dökülür, değişince genişlikler biçim değiştirir, çıkan aşamalar kapanır. `true` (varsayılan), `false`, bir easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da `(ctx) => …`. */
  animate?: MaybeReactive<AnimateProp>;
}

interface Stage<D> { key: string; label: string; index: number; position: number; value: number; datum: D; share: number; conversion: number | null; dropoff: number | null }
/** A stage in flow coordinates: along the flow a0..a1, half widths across it at both ends, wp = previous stage's half width. */
interface Geo { a0: number; a1: number; w0: number; w1: number; wp: number }
const ZERO: Geo = { a0: 0, a1: 0, w0: 0, w1: 0, wp: 0 };

const NAMED: Record<string, string> = { good: "var(--m-chart-good)", bad: "var(--m-chart-bad)", neutral: "var(--m-chart-muted)" };
/** A theme token ("brand-blue", "--my-var") or a CSS color as a CSS value. */
const tok = (c: string): string => NAMED[c] ?? (c.startsWith("--") ? `var(${c})` : /^[a-z]+(-[a-z0-9]+)*$/.test(c) && !/^(white|black|red|green|blue|orange|purple|gray|grey|transparent|gold|pink|teal|navy)$/.test(c) ? `var(--m-${c})` : c);
/** Pour in: one stage after another on the first draw, then a plain spring. */
const POUR = (c: MotionContext): AnimateOptions | boolean => (c.phase === "enter" ? { stagger: 90 } : true);

/** Funnel chart. See docs.md for props. */
export function FunnelChart<D>(props: FunnelChartProps<D>): Element {
  const size = useSize(props, 560, 300);
  const hidden = signal(new Set<string>()), active = signal(-1);
  const tip = tooltipState();
  let svg: Element | null = null;
  const how = (): AnimateProp => { const a = animateOf(props.animate as AnimateProp); return a === undefined || a === true ? POUR : a; };
  const on = (p: Opt<boolean>): boolean => read(p) ?? true;

  const rows = computed(() => rowsOf(props.data));
  const label = computed(() => accessor<D>(props.x ?? "label"));
  const value = computed(() => accessor<D>(props.y ?? "value"));
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const shareFmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.shareFormat), (v) => applyPipe("percent", v)));
  const convFmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.conversionFormat), (v) => applyPipe("percent", v, 1)));
  const shape = computed((): FunnelShape => { const s = read(props.shape); return s === "bars" || s === "pyramid" ? s : "funnel"; });
  const horizontal = computed(() => read(props.orientation) === "horizontal");

  const all = computed(() => { const l = label(), v = value(); return rows().map((d, i) => ({ key: String(l(d, i)), label: String(l(d, i)), index: i, value: Math.max(0, num(v(d, i)) ?? 0), datum: d })); });
  const stages = computed((): Stage<D>[] => {
    const list = all().filter((s) => !hidden().has(s.key)), first = list[0]?.value ?? 0;
    return list.map((s, i) => { const prev = i ? (list[i - 1] as { value: number }).value : null;
      return { ...s, position: i, share: first ? s.value / first : 0, conversion: prev == null ? null : prev ? s.value / prev : 0, dropoff: prev == null ? null : prev - s.value }; });
  });
  const pres = presence(stages, (s) => s.key, how);

  const pointAt = (s: Stage<D> | undefined): FunnelPoint<D> | undefined => s && { index: s.index, position: s.position, datum: s.datum, label: s.label, value: s.value, share: s.share, conversion: s.conversion, dropoff: s.dropoff };
  const inner = (s: Stage<D>): string => {
    if (props.label) return props.label(pointAt(s) as FunnelPoint<D>);
    return [on(props.showValue) && fmt()(s.value), on(props.showShare) && shareFmt()(s.share)].filter((x) => x !== false && x !== "").join(" · ");
  };
  const between = (s: Stage<D>): string => {
    if (s.conversion == null) return "";
    const d = s.dropoff ?? 0;
    return [on(props.showConversion) && `↓ ${convFmt()(s.conversion)}`, on(props.dropoff) && d !== 0 && `${d > 0 ? "−" : "+"}${fmt()(Math.abs(d))}`].filter(Boolean).join("  ");
  };

  const box = computed((): Box => {
    const W = size.width(), H = size.height(), list = stages();
    const gapText = Math.max(0, ...list.map((s) => textWidth(between(s), 6.2)));
    if (horizontal()) { const top = on(props.names) ? 22 : 6, bottom = gapText ? 22 : 6; return { x: 6, y: top, w: Math.max(10, W - 12), h: Math.max(10, H - top - bottom) }; }
    const lw = on(props.names) ? Math.min(170, 16 + Math.max(0, ...list.map((s) => textWidth(s.label, 6.8)))) : 6;
    const rw = gapText ? Math.min(150, 14 + gapText) : 6;
    return { x: lw, y: 6, w: Math.max(10, W - lw - rw), h: Math.max(10, H - 12) };
  }, { equals: sameBox });

  // target geometry of every shown stage, in flow coordinates
  const layout = computed(() => {
    const list = stages(), b = box(), hz = horizontal(), sh = shape(), n = list.length, out = new Map<string, Geo>();
    if (!n) return out;
    const L = hz ? b.w : b.h, half = (hz ? b.h : b.w) / 2, gap = Math.max(0, num(read(props.gap)) ?? 6);
    const free = Math.max(1, L - gap * (n - 1)), max = Math.max(...list.map((s) => s.value)) || 1, sum = list.reduce((a, s) => a + s.value, 0) || 1;
    const w = (v: number): number => (v > 0 ? Math.max(1.5, (half * v) / max) : 0);
    let a = 0, prevW = 0;
    list.forEach((s, i) => {
      let g: Geo;
      if (sh === "pyramid") {
        // thickness by value, with a floor so a small stage still holds its text
        const floor = Math.min(22, free / n), len = floor + ((free - floor * n) * s.value) / sum, ap = (x: number): number => half * Math.max(0, 1 - x / L);
        g = { a0: a, a1: a + len, w0: ap(a), w1: ap(a + len), wp: 0 };
      } else {
        const len = free / n, w0 = w(s.value), next = list[i + 1];
        g = { a0: a, a1: a + len, w0, w1: sh === "funnel" && next ? w(next.value) : w0, wp: sh === "bars" && i ? prevW : 0 };
        prevW = w0;
      }
      a = g.a1 + gap;
      out.set(s.key, g);
    });
    return out;
  });

  // flow coordinate → screen; the vertical pyramid rises from its base
  const along = (a: number): number => { const b = box(); return horizontal() ? b.x + a : shape() === "pyramid" ? b.y + b.h - a : b.y + a; };
  const center = (): number => { const b = box(); return horizontal() ? b.y + b.h / 2 : b.x + b.w / 2; };
  const pt = (a: number, s: number): string => { const p = f1(along(a)), q = f1(center() + s); return horizontal() ? `${p},${q}` : `${q},${p}`; };
  const pathOf = (g: Geo): string => {
    if (g.w0 <= 0 && g.w1 <= 0) return "";
    if (shape() === "funnel") { const m = (g.a0 + g.a1) / 2;
      return `M${pt(g.a0, -g.w0)}C${pt(m, -g.w0)} ${pt(m, -g.w1)} ${pt(g.a1, -g.w1)}L${pt(g.a1, g.w1)}C${pt(m, g.w1)} ${pt(m, g.w0)} ${pt(g.a0, g.w0)}Z`; }
    return `M${pt(g.a0, -g.w0)}L${pt(g.a1, -g.w1)}L${pt(g.a1, g.w1)}L${pt(g.a0, g.w0)}Z`;
  };
  const ghostOf = (g: Geo): string => (g.wp > 0 && on(props.dropoff) ? `M${pt(g.a0, -g.wp)}L${pt(g.a1, -g.wp)}L${pt(g.a1, g.wp)}L${pt(g.a0, g.wp)}Z` : "");
  const fill = (position: number, index: number): Record<string, string> | undefined => {
    const own = read(props.colors)?.[index];
    if (own) return { "--m-c": String(own) };
    const c = read(props.color);
    if (!c) return undefined;
    const n = stages().length, pct = n < 2 ? 100 : Math.round(100 - (58 * position) / (n - 1));
    return { "--m-c": `color-mix(in oklab, ${tok(c)} ${pct}%, var(--m-chart-bg))` };
  };

  const show = (k: number): void => {
    active.set(k);
    const opt = read(props.tooltip), s = stages()[k], g = s && layout().get(s.key);
    if (!s || !g || opt === false) return void tip.at.set(null);
    const p = pointAt(s) as FunnelPoint<D>, mid = along((g.a0 + g.a1) / 2), c = center() + (horizontal() ? 0 : Math.max(g.w0, g.w1) / 2);
    const content = typeof opt === "function" ? () => opt(p) : () => tipBody(s.label, [
      { label: read(props.yLabel) ?? t`Value`, value: fmt()(s.value), index: s.index },
      { label: t`Of first`, value: shareFmt()(s.share), index: s.index },
      ...(s.conversion == null ? [] : [{ label: t`Conversion`, value: convFmt()(s.conversion), index: s.index }, { label: t`Drop-off`, value: fmt()(s.dropoff), index: s.index }]),
    ], props.colors);
    showTip(tip, svg, size.width(), horizontal() ? mid : c, horizontal() ? c : mid, content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const select = (k = active.peek()): void => { const p = pointAt(stages()[k]); if (p) props.onSelect?.(p); };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const k = navIndex(e.key, active.peek(), 0, stages().length - 1);
    if (k == null || !stages().length) return;
    e.preventDefault();
    show(k);
  };
  const activeKey = (): string | undefined => stages()[active()]?.key;

  const last = new Map<string, Geo>();
  const body = [
    h("g", { class: "m-chart-plot", onPointerLeave: hide },
      each<Stage<D> & { leaving?: boolean }>({ each: pres.items, key: (s) => s.key, children: (s) => {
        const key = untrack(s).key;
        const target = (): Geo => {
          const st = s(), now = st.leaving ? undefined : layout().get(st.key);
          if (now) { last.set(st.key, now); return now; }
          const l = last.get(st.key) ?? ZERO;
          return { ...l, w0: 0, w1: 0, wp: 0 };
        };
        const g = tween(target, ["a0", "a1", "w0", "w1", "wp"], how, (to) => ({ ...to, a1: to.a0, w1: to.w0, wp: 0 }),
          { index: () => s().position, key, leaving: () => !!s().leaving, onSettle: () => { if (untrack(s).leaving) { last.delete(key); pres.done(key); } } });
        const at = (): number => { const v = g(); return along((v.a0 + v.a1) / 2); };
        const enter = (): void => { const k = stages().findIndex((x) => x.key === key); if (k >= 0) show(k); };
        return h("g", {
          class: () => `m-funnel-stage ${seriesClass(s().index)}`, "class:m-funnel-leaving": () => !!s().leaving,
          "class:m-chart-active": () => activeKey() === key, style: () => fill(s().position, s().index),
          onPointerEnter: enter, onClick: () => { const k = stages().findIndex((x) => x.key === key); if (k >= 0) select(k); },
        },
        h("path", { class: "m-funnel-ghost", d: attr(() => (shape() === "bars" ? ghostOf(g()) : "")) }),
        h("path", { class: "m-funnel-shape", d: attr(() => pathOf(g())) }),
        h("text", { class: "m-funnel-value", "text-anchor": "middle", "dominant-baseline": "central",
          x: attr(() => f1(horizontal() ? at() : center())), y: attr(() => f1(horizontal() ? center() : at())) }, () => inner(s())),
        () => (on(props.names) ? h("text", { class: "m-funnel-name", "text-anchor": () => (horizontal() ? "middle" : "end"), "dominant-baseline": "central",
          x: attr(() => f1(horizontal() ? at() : box().x - 10)), y: attr(() => f1(horizontal() ? box().y - 11 : at())) }, () => s().label) : null),
        () => (s().position > 0 ? h("text", { class: "m-funnel-between", "text-anchor": () => (horizontal() ? "middle" : "start"), "dominant-baseline": "central",
          x: attr(() => { const b = box(); return f1(horizontal() ? along(g().a0 - (num(read(props.gap)) ?? 6) / 2) : b.x + b.w + 10); }),
          y: attr(() => { const b = box(); return f1(horizontal() ? b.y + b.h + 12 : along(g().a0 - (num(read(props.gap)) ?? 6) / 2)); }) }, () => between(s())) : null));
      } })),
  ];

  return Frame<Stage<D>>(props, {
    kind: "funnel", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => rows().length === 0, tip,
    legend: { items: () => (read(props.legend) ? all() : []), hidden },
    table: {
      caption: () => read(props.title), rows: stages,
      columns: () => [{ label: read(props.xLabel) ?? t`Stage`, value: (s: Stage<D>) => s.label },
        { label: read(props.yLabel) ?? t`Value`, value: (s: Stage<D>) => fmt()(s.value) },
        { label: t`Of first`, value: (s: Stage<D>) => shareFmt()(s.share) },
        { label: t`Conversion`, value: (s: Stage<D>) => (s.conversion == null ? "" : convFmt()(s.conversion)) }],
    },
  });
}
