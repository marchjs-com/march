// RadialBarChart: concentric rings of bars on a track, one ring per row (march/charts). Folder:
// src/components/data/radial-bar-chart/; shared chart parts (frame, tooltip, legend, data table, motion, polar geometry)
// are in src/charts/. Rings are a presence list keyed by label: they sweep to their value (stagger ring by ring), morph
// their sweep and radius on a data change, and a ring that leaves unwinds to its start before it is removed.
import "./radial-bar-chart.css";
import { signal, computed, read } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, dir } from "../../../core/i18n.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, useSize, attr, navIndex, each, f1,
  type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp } from "../../../charts/util.ts";
import { tween, presence, animateOf, type AnimateProp, type Present } from "../../../charts/motion.ts";
import { Frame, tooltipState, showTip, tipBody } from "../../../charts/parts.ts";
import { TAU, polar, arcLine } from "../../../charts/arc.ts";
import { clamp, type Handler } from "../../../core/util.ts";
import { isActivateKey } from "../../../ui/behave.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** Point passed to `tooltip(point)`, `center(point)` and `onSelect(point)` of a radial bar chart. */
export interface RadialBarPoint<D> { index: number; datum: D; label: string; value: number; max: number; share: number }
export interface RadialBarChartProps<D = unknown> extends ChartBaseProps {
  /** Rows: one ring per row (the first is the outermost); an array, a signal or a function returning one. @tr Satırlar: her satır bir halka (ilki en dıştaki); dizi, sinyal ya da onu döndüren fonksiyon. */
  data?: DataProp<D>;
  /** The ring label: a key or getter (default "label"). @tr Halka etiketi: anahtar ya da getter (varsayılan "label"). */
  x?: Field<D> | undefined;
  /** The ring value: a key or getter (default "value"); negative values count as 0. @tr Halka değeri: anahtar ya da getter (varsayılan "value"); negatif değerler 0 sayılır. */
  y?: Field<D> | undefined;
  /** The value of a full sweep for every ring (default the largest value). @tr Her halkada tam turun değeri (varsayılan en büyük değer). */
  max?: Opt<number>;
  /** A ring's own full-sweep value read from its row: a key or getter (wins over `max`). @tr Halkanın kendi tam tur değeri satırından okunur: anahtar ya da getter (`max`'ı geçersiz kılar). */
  rowMax?: Field<D> | undefined;
  /** Where the rings start, degrees clockwise from 12 o'clock (default 0). @tr Halkaların başladığı açı, saat 12'den saat yönünde derece (varsayılan 0). */
  startAngle?: Opt<number>;
  /** Where a full ring ends, degrees (default 270: the free quarter holds the labels; 360 a full circle, -135..135 a gauge arc). @tr Tam halkanın bittiği açı, derece (varsayılan 270: boş çeyrekte etiketler durur; 360 tam daire, -135..135 gösterge yayı). */
  endAngle?: Opt<number>;
  /** Hole in the middle as a share of the radius 0..0.9 (default 0.3). @tr Ortadaki boşluk, yarıçapın oranı olarak 0..0.9 (varsayılan 0.3). */
  innerRadius?: Opt<number>;
  /** Space between rings as a share of a ring's band 0..0.9 (default 0.28). @tr Halkalar arası boşluk, bir halka bandının oranı olarak 0..0.9 (varsayılan 0.28). */
  gap?: Opt<number>;
  /** Rounded bar ends (default true). @tr Yuvarlak çubuk uçları (varsayılan true). */
  rounded?: Opt<boolean>;
  /** The faint full ring behind every bar (default true). @tr Her çubuğun arkasındaki silik tam halka (varsayılan true). */
  track?: Opt<boolean>;
  /** Ring labels at the ring starts (default true). @tr Halkaların başında etiketler (varsayılan true). */
  labels?: Opt<boolean>;
  /** The middle: by default the active (or first) ring's value and label; a value, `(point) => content`, or `false` for none. @tr Orta alan: varsayılan olarak etkin (ya da ilk) halkanın değeri ve etiketi; bir değer, `(point) => content` ya da hiçbiri için `false`. */
  center?: Opt<unknown>;
  /** Value format for center, tooltip and table: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Orta alan, araç ipucu ve tablo için değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Header of the label column in the data table (default "Label"). @tr Veri tablosundaki etiket sütununun başlığı (varsayılan "Label"). */
  xLabel?: Opt<string>;
  /** Header of the value column in the data table (default "Value"). @tr Veri tablosundaki değer sütununun başlığı (varsayılan "Value"). */
  yLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<RadialBarPoint<D>>;
  /** Called with the ring's point on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki halkada Enter / Space'e basılınca noktayla çağrılır. */
  onSelect?: Handler<[p: RadialBarPoint<D>]> | undefined;
  /** Rings sweep to their value, morph on change and unwind when they leave: `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. @tr Halkalar değerlerine döner, değişince biçim değiştirir, giderken geri sarılır: `true` (varsayılan, yay), `false`, easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da `(ctx) => …`. */
  animate?: AnimateProp | (() => AnimateProp);
}

interface Ring<D> { key: string; label: string; index: number; value: number; max: number; share: number; datum: D; r: number; th: number }
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Radial bar chart. See docs.md for props. */
export function RadialBarChart<D>(props: RadialBarChartProps<D>): Element {
  const size = useSize(props, 320, 280);
  const hidden = signal(new Set<string>()), active = signal(-1);
  const tip = tooltipState();
  const how = (): AnimateProp => animateOf(props.animate);
  let svg: Element | null = null;

  const rows = computed(() => rowsOf(props.data));
  const labelOf = computed(() => accessor<D>(props.x ?? "label"));
  const valueOf = computed(() => accessor<D>(props.y ?? "value"));
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const items = computed(() => {
    const l = labelOf(), v = valueOf(), rm = props.rowMax != null ? accessor<D>(props.rowMax) : null;
    const list = rows().map((d, i) => ({ key: String(l(d, i)), label: String(l(d, i) ?? ""), index: i, value: Math.max(0, num(v(d, i)) ?? 0), datum: d, own: rm ? num(rm(d, i)) : null }));
    const top = num(read(props.max)) ?? Math.max(0, ...list.map((x) => x.value));
    return list.map((x) => { const max = x.own && x.own > 0 ? x.own : top > 0 ? top : 1; return { ...x, max, share: clamp(x.value / max, 0, 1) }; });
  });
  const shown = computed(() => items().filter((x) => !hidden().has(x.key)));
  const angles = computed(() => {
    const a0 = rad(num(read(props.startAngle)) ?? 0), a1 = rad(num(read(props.endAngle)) ?? 270);
    return { a0: Math.min(a0, a1), sweep: clamp(Math.abs(a1 - a0), 0.01, TAU) };
  });
  const geo = computed(() => {
    const w = size.width(), hh = size.height(), R = Math.max(16, Math.min(w, hh) / 2 - 6);
    return { cx: w / 2, cy: hh / 2, R, r0: R * clamp(num(read(props.innerRadius)) ?? 0.3, 0, 0.9) };
  }, { equals: (a, b) => !!a && a.cx === b.cx && a.cy === b.cy && a.R === b.R && a.r0 === b.r0 });
  const rings = computed((): Ring<D>[] => {
    const list = shown(), g = geo(), band = (g.R - g.r0) / Math.max(1, list.length), gap = clamp(num(read(props.gap)) ?? 0.28, 0, 0.9);
    return list.map((x, i) => ({ key: x.key, label: x.label, index: x.index, value: x.value, max: x.max, share: x.share, datum: x.datum, r: f1(g.R - band * i - band / 2), th: f1(band * (1 - gap)) }));
  });
  const pres = presence(rings, (r) => r.key, how);

  const pointAt = (k: number): RadialBarPoint<D> | undefined => { const r = rings()[k]; return r && { index: r.index, datum: r.datum, label: r.label, value: r.value, max: r.max, share: r.share }; };
  const show = (k: number): void => {
    active.set(k);
    const opt = read(props.tooltip), r = rings()[k];
    if (!r || opt === false) return void tip.at.set(null);
    const g = geo(), an = angles(), [x, y] = polar(g.cx, g.cy, r.r, an.a0 + an.sweep * r.share);
    const content = typeof opt === "function" ? () => opt(pointAt(k) as RadialBarPoint<D>)
      : () => tipBody(r.label, [{ label: `${Math.round(r.share * 100)}%`, value: `${String(fmt()(r.value))} / ${String(fmt()(r.max))}`, index: r.index }], props.colors);
    showTip(tip, svg, size.width(), x, y, content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const select = (k = active.peek()): void => { const p = pointAt(k); if (p) props.onSelect?.(p); };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const k = navIndex(e.key, active.peek(), 0, rings().length - 1);
    if (k == null || !rings().length) return;
    e.preventDefault();
    show(k);
  };
  const where = (key: string): number => rings().findIndex((x) => x.key === key);

  // a stroked arc with round caps reaches half a stroke past its ends: pull the ends in so the bar spans exactly [a, b]
  const bar = (r: number, th: number, a: number, b: number, round: boolean): string => {
    const g = geo();
    if (b - a <= 1e-4) return "";
    if (b - a >= TAU - 1e-6) return arcLine(g.cx, g.cy, r, a, a + TAU);
    const cap = round ? Math.min(th / 2 / Math.max(1, r), (b - a) / 2) : 0;
    if (b - a - 2 * cap <= 1e-4) { const [x, y] = polar(g.cx, g.cy, r, a + cap); return `M${f1(x)},${f1(y)}L${f1(x)},${f1(y)}`; }
    return arcLine(g.cx, g.cy, r, a + cap, b - cap);
  };
  const roundOn = (): boolean => read(props.rounded) !== false;
  const labelAt = (r: number): { x: number; y: number; anchor: string } => {
    const g = geo(), a = angles().a0, [x, y] = polar(g.cx, g.cy, r, a);
    // just before the ring start, along the tangent (cos a, sin a) of the clockwise sweep
    const tx = Math.cos(a), ty = Math.sin(a), side = tx > 0.3 ? -1 : tx < -0.3 ? 1 : 0;
    const anchor = side === 0 ? "middle" : (side > 0) !== (dir() === "rtl") ? "start" : "end";
    return { x: f1(x - tx * 8), y: f1(y - ty * 8), anchor };
  };

  const centerPoint = (): RadialBarPoint<D> | undefined => pointAt(active() >= 0 ? active() : 0);
  const body = [
    h("g", { class: () => `m-chart-plot m-radial-plot${active() >= 0 ? " m-radial-focus" : ""}`, onPointerLeave: hide },
      each<Present<Ring<D>>>({ each: pres.items, key: (r) => r.key, children: (r) => {
        const key = r().key;
        const t = tween(() => { const v = r(), an = angles(); return { start: an.a0, end: an.a0 + (v.leaving ? 0 : an.sweep * v.share), r: v.r, th: v.th }; }, ["start", "end", "r", "th"], how,
          (to) => ({ ...to, end: to.start }),
          { index: () => Math.max(0, where(key)), key, leaving: () => !!r().leaving, onSettle: () => { if (r().leaving) pres.done(key); } });
        const enter = (): void => { const k = where(key); if (k >= 0) show(k); };
        return h("g", {
          class: () => `m-radial-ring ${seriesClass(r().index)}`, "class:m-chart-active": () => active() >= 0 && rings()[active()]?.key === key, "class:m-chart-leaving": () => !!r().leaving,
          style: () => colorStyle(props.colors, r().index), onPointerEnter: enter, onClick: () => select(where(key)),
        },
        () => (read(props.track) === false ? null : h("path", { class: "m-radial-track", "stroke-width": () => t().th, "stroke-linecap": () => (roundOn() ? "round" : "butt"),
          d: attr(() => { const v = t(), an = angles(); return bar(v.r, v.th, an.a0, an.a0 + an.sweep, roundOn()); }) })),
        h("path", { class: "m-radial-bar", "stroke-width": () => t().th, "stroke-linecap": () => (roundOn() ? "round" : "butt"),
          d: attr(() => { const v = t(); return bar(v.r, v.th, v.start, v.end, roundOn()); }) }),
        () => (read(props.labels) === false ? null : h("text", {
          class: "m-radial-label", x: () => labelAt(t().r).x, y: () => labelAt(t().r).y, "text-anchor": () => labelAt(t().r).anchor, "dominant-baseline": "middle",
          visibility: () => (t().th >= 7 ? "visible" : "hidden"),
        }, () => r().label)));
      } })),
    () => {
      const c = read(props.center);
      if (c === false || geo().r0 < 18) return null;
      return h("g", { class: "m-radial-center", "aria-hidden": "true" }, () => {
        const p = centerPoint(), g = geo(), cv = read(props.center);
        if (typeof cv === "function") return h("text", { class: "m-radial-center-value", x: g.cx, y: g.cy, "text-anchor": "middle", "dominant-baseline": "middle" }, () => (p ? (cv as (p: RadialBarPoint<D>) => unknown)(p) as string : ""));
        if (cv != null) return h("text", { class: "m-radial-center-value", x: g.cx, y: g.cy, "text-anchor": "middle", "dominant-baseline": "middle" }, String(cv));
        if (!p) return null;
        return [h("text", { class: `m-radial-center-value ${seriesClass(p.index)}`, style: colorStyle(props.colors, p.index), x: g.cx, y: g.cy - 4, "text-anchor": "middle" }, String(fmt()(p.value))),
          h("text", { class: "m-radial-center-label", x: g.cx, y: g.cy + 14, "text-anchor": "middle" }, p.label)];
      });
    },
  ];

  return Frame<D>(props, {
    kind: "radial-bar", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => items().length === 0, tip,
    legend: { items: () => (read(props.legend) ? items() : []), hidden },
    table: {
      caption: () => read(props.title), rows,
      columns: () => [{ label: read(props.xLabel) ?? t`Label`, value: (d: D, i: number) => labelOf()(d, i) },
        { label: read(props.yLabel) ?? t`Value`, value: (_d: D, i: number) => { const x = items()[i]; return x ? `${String(fmt()(x.value))} / ${String(fmt()(x.max))}` : ""; } }],
    },
  });
}
