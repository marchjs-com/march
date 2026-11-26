// BarChart: grouped, stacked or horizontal bars (march/charts). Folder: src/components/data/bar-chart/; shared chart parts (scales, axes, tooltip, data table,
// formats) are in src/charts/.
// BarChart: categories × series, grouped (default) or `stacked`, vertical (default) or `horizontal`.
// Bars are a keyed list ("category|series"); each rect binds x/y/width/height through computeds, so a data change only
// writes the attributes of bars whose geometry changed.
import "./bar-chart.css";
import { signal, computed, read, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { scaleLinear, scaleBand, niceTicks } from "../../../charts/scale.ts";
import { rowsOf, accessor, formatter, num, seriesOf, seriesClass, colorStyle, useSize, attr, textWidth, navIndex, sameBox, each, tween, presence, animateOf, type AnimateProp, type Present,
  type MaybeReactive, type DataProp, type Field, type SeriesSpec, type SeriesLabels, type FormatSpec, type ChartBaseProps, type ChartPoint, type TooltipProp, type Box, f1 } from "../../../charts/util.ts";
import { Frame, Axis, Grid, tooltipState, showTip, tipBody, thin, type Tick } from "../../../charts/parts.ts";
import { clamp, type Handler } from "../../../core/util.ts";
import { RefMarks, statOf, type RefMarksProp } from "../../../charts/marks.ts";
import { isActivateKey } from "../../../ui/behave.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

export interface BarChartProps<D = unknown> extends ChartBaseProps {
  /** Rows: an array (or signal / function returning one) of objects. @tr Satırlar: nesnelerden oluşan bir dizi (ya da onu döndüren sinyal / fonksiyon). */
  data?: DataProp<D>;
  /** The category: a key or `(row, i) => value` (default the index). @tr Kategori: bir anahtar ya da `(row, i) => value` (varsayılan sıra numarası). */
  x?: Field<D> | undefined;
  /** Value series: a key, a getter, or a list of them (one series each; default "y"). @tr Değer serileri: bir anahtar, bir getter ya da bunların listesi (her biri bir seri; varsayılan "y"). */
  y?: SeriesSpec<D> | readonly SeriesSpec<D>[] | undefined;
  /** Series labels for legend, tooltip and table: aligned with `y`, keyed by series key, or one label. @tr Gösterge, araç ipucu ve tablo için seri etiketleri: `y` ile sıralı, seri anahtarına göre ya da tek bir etiket. */
  series?: SeriesLabels | undefined;
  /** Categories on the y axis, bars grow to the right. @tr Kategoriler y ekseninde, çubuklar sağa doğru uzar. */
  horizontal?: Opt<boolean>;
  /** "vertical" (default) or "horizontal"; same as `horizontal`. @tr "vertical" (varsayılan) ya da "horizontal"; `horizontal` ile aynı. */
  orientation?: Opt<"vertical" | "horizontal">;
  /** Stack the series in one bar (negative values stack downwards). @tr Serileri tek çubukta üst üste koyar (negatif değerler aşağı doğru yığılır). */
  stacked?: Opt<boolean>;
  /** Format of the x labels: a pipe name, `[pipe, ...args]` or a function; time axes pick one by default. @tr x etiketlerinin biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon; zaman eksenleri varsayılanı kendisi seçer. */
  xFormat?: Opt<FormatSpec>;
  /** Value format for axis, tooltip and table: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Eksen, araç ipucu ve tablo için değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Fixes the low end of the value axis (still rounded to nice ticks). @tr Değer ekseninin alt ucunu sabitler (yine de düzgün çentiklere yuvarlanır). */
  yMin?: Opt<number>;
  /** Fixes the high end of the value axis (still rounded to nice ticks). @tr Değer ekseninin üst ucunu sabitler (yine de düzgün çentiklere yuvarlanır). */
  yMax?: Opt<number>;
  /** Grid lines along the value axis (default true). @tr Değer ekseni boyunca ızgara çizgileri (varsayılan true). */
  grid?: Opt<boolean>;
  /** Header of the x column in the data table (default the x key). @tr Veri tablosundaki x sütununun başlığı (varsayılan x anahtarı). */
  xLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<ChartPoint<D>>;
  /** Called with the point on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki öğede Enter / Space'e basılınca noktayla çağrılır. */
  onSelect?: Handler<[p: ChartPoint<D>]> | undefined;
  /** Change animations: bars grow from the baseline (one after another with `stagger`), glide to new values and sink when they leave. `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. @tr Değişim animasyonları: çubuklar tabandan büyür (`stagger` ile sırayla), yeni değerlere kayar ve ayrılırken çöker. `true` (varsayılan, yay), `false`, bir easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da `(ctx) => …`. */
  animate?: AnimateProp | (() => AnimateProp);
  /** Value labels on the bars: `true` / "outside" (past the end), "inside" (in the bar), or `false` (default). @tr Çubuklarda değer etiketleri: `true` / "outside" (ucun ötesinde), "inside" (çubuğun içinde) ya da `false` (varsayılan). */
  labels?: Opt<boolean | "inside" | "outside">;
  /** Reference lines, bands and averages on the value axis (vertical bars): `[{ y: 100, label: "Hedef" }, { y: "average" }, { x: ["Mar", "May"] }]`. @tr Değer ekseninde referans çizgileri, bantlar ve ortalamalar (dikey çubuklar): `[{ y: 100, label: "Hedef" }, { y: "average" }, { x: ["Mar", "May"] }]`. */
  marks?: RefMarksProp;
}
interface Bar { key: string; index: number; si: number; x: number; y: number; width: number; height: number; value: number; neg: boolean; z: number }

/** The geometry a bar is drawn with: grows in from the baseline, glides to new values, sinks back when it leaves. */
function glide(target: () => Present<Bar>, how: () => AnimateProp, hz: boolean, done: (k: string) => void): () => Bar {
  const flat = (b: Bar): Bar => (hz ? { ...b, x: b.z, width: 0 } : { ...b, y: b.z, height: 0 });
  const key = untrack(target).key;
  const g = tween(() => { const b = target(); return b.leaving ? flat(b) : b; }, ["x", "y", "width", "height"], how, flat,
    { index: () => target().index, key, leaving: () => !!target().leaving, onSettle: () => { if (target().leaving) done(key); } });
  return () => { const b = g(); return b.width < 0 || b.height < 0 ? { ...b, width: Math.max(0, b.width), height: Math.max(0, b.height) } : b; };
}

/** Bar chart. See docs/charts.md for props. */
export function BarChart<D>(props: BarChartProps<D>): Element {
  const size = useSize(props, 640, 260);
  const hidden = signal(new Set<string>()), active = signal(-1);
  const tip = tooltipState();
  let svg: Element | null = null;

  const horizontal = computed(() => !!read(props.horizontal) || read(props.orientation) === "horizontal");
  const stacked = computed(() => !!read(props.stacked));
  const rows = computed(() => rowsOf(props.data));
  const series = computed(() => seriesOf(props.y, props.series));
  const visible = computed(() => series().filter((s) => !hidden().has(s.key)));
  const cats = computed(() => { const g = accessor<D>(props.x, (d, i) => i); return rows().map((d, i) => g(d, i)); });
  const xFmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.xFormat), (v) => String(v ?? "")));
  const yFmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const values = computed(() => { const r = rows(); return visible().map((s) => r.map((d, i) => num(s.get(d, i)))); });

  const nice = computed(() => {
    let lo = 0, hi = 0;
    const vals = values(), n = rows().length;
    for (let i = 0; i < n; i++) {
      let pos = 0, neg = 0;
      for (const v of vals) {
        const x = v[i] ?? 0;
        if (stacked()) x >= 0 ? (pos += x) : (neg += x);
        else { pos = Math.max(pos, x); neg = Math.min(neg, x); }
      }
      hi = Math.max(hi, pos); lo = Math.min(lo, neg);
    }
    const len = horizontal() ? size.width() - 120 : size.height() - 40;
    return niceTicks(num(read(props.yMin)) ?? lo, num(read(props.yMax)) ?? hi, Math.max(2, Math.floor(len / (horizontal() ? 90 : 40))));
  });
  const box = computed((): Box => {
    const t = 12, r = 16, f = yFmt(), x = xFmt();
    if (horizontal()) {
      const ml = Math.min(160, Math.max(40, 12 + Math.max(0, ...cats().map((c) => textWidth(x(c))))));
      return { x: ml, y: t, w: Math.max(10, size.width() - ml - r), h: Math.max(10, size.height() - t - 28) };
    }
    const ml = Math.min(120, Math.max(32, 12 + Math.max(0, ...nice().ticks.map((v) => textWidth(f(v))))));
    return { x: ml, y: t, w: Math.max(10, size.width() - ml - r), h: Math.max(10, size.height() - t - 28) };
  }, { equals: sameBox });
  // value scale (px along the value axis) and band scale (px along the category axis)
  const vs = computed(() => { const b = box(); return scaleLinear([nice().min, nice().max], horizontal() ? [0, b.w] : [b.h, 0]); });
  const band = computed(() => { const b = box(); return scaleBand(rows().map((_, i) => i), [0, horizontal() ? b.h : b.w], { paddingInner: 0.2, paddingOuter: 0.1 }); });

  const bars = computed(() => {
    const vals = values(), vis = visible(), bs = band(), v = vs(), c = cats(), out: Bar[] = [];
    const zero = v(clamp(0, nice().min, nice().max));
    const inner = stacked() ? bs.bandwidth : bs.bandwidth / Math.max(1, vis.length);
    for (let i = 0; i < c.length; i++) {
      let pos = 0, neg = 0;
      vis.forEach((s, j) => {
        const x = (vals[j] as (number | null)[])[i];
        if (x == null) return;
        let a: number, b: number;
        if (stacked()) { if (x >= 0) { a = pos; b = pos += x; } else { a = neg; b = neg += x; } } else { a = 0; b = x; }
        const p0 = a === 0 ? zero : v(a), p1 = v(b);
        const along = bs(i) + (stacked() ? 0 : j * inner), lo = Math.min(p0, p1), len = Math.abs(p1 - p0);
        const geo = horizontal() ? { x: lo, y: along, width: len, height: inner } : { x: along, y: lo, width: inner, height: len };
        out.push({ key: `${String(c[i])}|${s.key}`, index: i, si: s.index, value: x, neg: x < 0, z: zero, ...geo });
      });
    }
    return out;
  });

  const catTicks = computed((): Tick[] => {
    const bs = band(), f = xFmt(), c = cats(), len = horizontal() ? box().h / 22 : box().w / 70;
    return thin(c.map((_, i) => i), Math.max(2, Math.floor(len))).map((i) => ({ key: i, pos: f1(bs.center(i)), label: f(c[i]) }));
  });
  const valTicks = computed((): Tick[] => { const s = vs(), f = yFmt(); return nice().ticks.map((t) => ({ key: t, pos: f1(s(t)), label: f(t) })); });

  const pointAt = (i: number): ChartPoint<D> => {
    const d = rows()[i], vis = visible(), values: Record<string, number | null> = {};
    for (const s of vis) values[s.key] = num(s.get(d as D, i));
    return { index: i, datum: d, x: cats()[i], label: xFmt()(cats()[i]), values, series: vis[0]?.key ?? null, y: vis[0] ? values[vis[0].key] : null };
  };
  const show = (i: number): void => {
    active.set(i);
    const opt = read(props.tooltip);
    if (i < 0 || opt === false) return void tip.at.set(null);
    const p = pointAt(i), b = box(), f = yFmt(), bs = band();
    const content = typeof opt === "function" ? () => opt(p)
      : () => tipBody(p.label, visible().map((s) => ({ label: s.label, value: f(p.values[s.key]), index: s.index })), props.colors);
    if (horizontal()) showTip(tip, svg, size.width(), b.x + b.w / 2, b.y + bs.center(i), content);
    else showTip(tip, svg, size.width(), b.x + bs.center(i), b.y + b.h / 3, content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const select = (i = active.peek()): void => { if (i >= 0) props.onSelect?.(pointAt(i)); };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const i = navIndex(e.key, active.peek(), 0, rows().length - 1);
    if (i == null || !rows().length) return;
    e.preventDefault();
    show(i);
  };

  const hz = untrack(horizontal);
  const how = (): AnimateProp => animateOf(props.animate);
  const live = presence(bars, (b) => b.key, how);
  const labelMode = computed(() => { const l = read(props.labels); return l === true ? "outside" : l || null; });
  const scales = {
    box,
    x: (v: unknown): number | null => { const i = cats().findIndex((c) => String(c) === String(v)); return i < 0 ? null : band().center(i); },
    xBand: () => band().step,
    y: (v: number) => vs()(v),
    stat: (st: "average" | "median" | "min" | "max", key: string | undefined) => {
      const sr = visible().find((x) => x.key === key) ?? visible()[0];
      return sr ? statOf(rows().map((d, i) => num(sr.get(d, i))), st) : null;
    },
    fmtX: (v: unknown) => xFmt()(v),
    fmtY: (v: unknown) => yFmt()(v),
  };
  const body = [
    Grid({ dir: hz ? "v" : "h", ticks: () => (read(props.grid) ?? true ? valTicks() : []), box }),
    Axis({ side: hz ? "bottom" : "left", ticks: valTicks, box }),
    Axis({ side: hz ? "left" : "bottom", ticks: catTicks, box }),
    hz ? null : RefMarks({ marks: props.marks, scales, layer: "back" }),
    h("g", { class: "m-chart-plot", transform: attr(() => `translate(${box().x},${box().y})`), onPointerLeave: hide },
      h("rect", { class: "m-chart-band", visibility: () => (active() >= 0 ? "visible" : "hidden"),
        ...(hz ? { x: 0, width: () => box().w, y: () => f1(band().center(Math.max(0, active())) - band().step / 2), height: () => f1(band().step) }
          : { y: 0, height: () => box().h, x: () => f1(band().center(Math.max(0, active())) - band().step / 2), width: () => f1(band().step) }) }),
      each<Present<Bar>>({ each: live.items, key: (b) => b.key, children: (b) => { const g = glide(b, how, hz, live.done); return [h("rect", {
        class: () => `m-chart-bar ${seriesClass(b().si)}`, "class:m-chart-active": () => active() === b().index, "class:m-chart-leaving": () => !!b().leaving,
        style: () => colorStyle(props.colors, b().si),
        x: attr(() => f1(g().x)), y: attr(() => f1(g().y)), width: attr(() => f1(g().width)), height: attr(() => f1(g().height)),
        onPointerEnter: () => show(b().index), onPointerMove: () => { if (active.peek() !== b().index) show(b().index); }, onClick: () => select(b().index),
      }), () => {
        const m = labelMode();
        if (!m || b().leaving) return null;
        const inside = m === "inside";
        // the label rides on the drawn bar end (it moves with the animation)
        const at = attr(() => { const q = g(), neg = b().neg; return hz ? { x: f1(neg ? q.x + (inside ? 6 : -6) : q.x + q.width + (inside ? -6 : 6)), y: f1(q.y + q.height / 2) } : { x: f1(q.x + q.width / 2), y: f1(neg ? q.y + q.height + (inside ? -6 : 12) : q.y + (inside ? 12 : -6)) }; });
        return h("text", { class: inside ? "m-chart-value m-chart-value-inside" : "m-chart-value", x: () => at().x, y: () => at().y, "dominant-baseline": hz ? "middle" : null,
          "text-anchor": () => (hz ? ((b().neg ? !inside : inside) ? "end" : "start") : "middle") }, () => String(yFmt()(b().value)));
      }]; } })),
    hz ? null : RefMarks({ marks: props.marks, scales, layer: "front" }),
  ];

  return Frame<D>(props, {
    kind: "bar", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => rows().length === 0, tip,
    legend: { items: () => { const l = read(props.legend); return l === false || (l == null && series().length < 2) ? [] : series(); }, hidden },
    table: {
      caption: () => read(props.title), rows,
      columns: () => [{ label: read(props.xLabel) ?? (typeof props.x === "string" ? props.x : "x"), value: (_d: D, i: number) => xFmt()(cats.peek()[i]) },
        ...series().map((s) => ({ label: s.label, value: (d: D, i: number) => yFmt()(num(s.get(d, i))) }))],
    },
  });
}
