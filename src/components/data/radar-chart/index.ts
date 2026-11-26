// RadarChart: one spoke per row, one filled polygon per series (march/charts). Folder: src/components/data/radar-chart/;
// shared chart parts (frame, tooltip, legend, data table, motion, polar geometry) are in src/charts/.
// Series are a presence list keyed by series key: a shape grows out of the center, its radii morph on a data change and a
// series that leaves (data or legend toggle) shrinks back into the center before it is removed.
import "./radar-chart.css";
import { signal, computed, read } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, dir } from "../../../core/i18n.ts";
import { rowsOf, accessor, formatter, num, seriesOf, seriesClass, colorStyle, useSize, attr, textWidth, navIndex, localPoint, each, f1,
  type MaybeReactive, type DataProp, type Field, type SeriesSpec, type SeriesLabels, type FormatSpec, type ChartBaseProps, type ChartPoint, type TooltipProp } from "../../../charts/util.ts";
import { tween, presence, animateOf, type AnimateProp, type Present } from "../../../charts/motion.ts";
import { Frame, tooltipState, showTip, tipBody } from "../../../charts/parts.ts";
import { TAU, polar, polygonPath } from "../../../charts/arc.ts";
import { clamp, type Handler } from "../../../core/util.ts";
import { isActivateKey } from "../../../ui/behave.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

export interface RadarChartProps<D = unknown> extends ChartBaseProps {
  /** Rows: one spoke (axis) per row; an array, a signal or a function returning one. @tr Satırlar: her satır bir eksen (kol); dizi, sinyal ya da onu döndüren fonksiyon. */
  data?: DataProp<D>;
  /** The axis name of a row: a key or getter (default "label"). @tr Bir satırın eksen adı: anahtar ya da getter (varsayılan "label"). */
  x?: Field<D> | undefined;
  /** Value series: a key, a getter or a list of them, one polygon each (default "value"). @tr Değer serileri: anahtar, getter ya da bunların listesi; her biri bir çokgen (varsayılan "value"). */
  y?: SeriesSpec<D> | readonly SeriesSpec<D>[] | undefined;
  /** Series labels for legend, tooltip and table: aligned with `y`, keyed by series key, or one label. @tr Gösterge, araç ipucu ve tablo için seri etiketleri: `y` ile sıralı, seri anahtarına göre ya da tek etiket. */
  series?: SeriesLabels | undefined;
  /** The value at the rim on a shared scale (default the largest value). @tr Ortak ölçekte çemberin kenarındaki değer (varsayılan en büyük değer). */
  max?: Opt<number>;
  /** "shared" (default: one max for every spoke) or "axis" (each spoke has its own max: `axisMax` or its largest value). @tr "shared" (varsayılan: her kol için tek üst sınır) ya da "axis" (her kolun kendi üst sınırı: `axisMax` ya da en büyük değeri). */
  scale?: Opt<"shared" | "axis">;
  /** Each spoke's max read from its row: a key or getter (turns on the "axis" scale). @tr Her kolun üst sınırı satırından okunur: anahtar ya da getter ("axis" ölçeğini açar). */
  axisMax?: Field<D> | undefined;
  /** Number of grid rings (default 4). @tr Izgara halkası sayısı (varsayılan 4). */
  levels?: Opt<number>;
  /** Grid rings as "polygon" (default) or "circle". @tr Izgara halkaları "polygon" (varsayılan) ya da "circle". */
  gridShape?: Opt<"polygon" | "circle">;
  /** Grid rings and spokes (default true). @tr Izgara halkaları ve kollar (varsayılan true). */
  grid?: Opt<boolean>;
  /** Fill opacity of the shapes 0..1 (default 0.22); `false` draws lines only. @tr Şekillerin dolgu opaklığı 0..1 (varsayılan 0.22); `false` yalnız çizgi çizer. */
  fill?: Opt<boolean | number>;
  /** A dot on every value (default true). @tr Her değerde bir nokta (varsayılan true). */
  dots?: Opt<boolean>;
  /** "linear" (default) or "smooth" (a closed curve through the values). @tr "linear" (varsayılan) ya da "smooth" (değerlerden geçen kapalı eğri). */
  curve?: Opt<"linear" | "smooth">;
  /** Axis names around the rim (default true). @tr Çemberin çevresinde eksen adları (varsayılan true). */
  axisLabels?: Opt<boolean>;
  /** The value of every grid ring along the first spoke (shared scale only; default false). @tr Her ızgara halkasının değeri ilk kol boyunca (yalnız ortak ölçekte; varsayılan false). */
  levelLabels?: Opt<boolean>;
  /** Value format for tooltip, table and level labels: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Araç ipucu, tablo ve halka değerleri için biçim: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Header of the axis column in the data table (default "Axis"). @tr Veri tablosundaki eksen sütununun başlığı (varsayılan "Axis"). */
  xLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<ChartPoint<D>>;
  /** Called with the spoke's point on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki kolda Enter / Space'e basılınca noktayla çağrılır. */
  onSelect?: Handler<[p: ChartPoint<D>]> | undefined;
  /** Shapes grow from the center, morph to new values and shrink away: `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. @tr Şekiller merkezden büyür, yeni değerlere dönüşür ve küçülerek gider: `true` (varsayılan, yay), `false`, easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da `(ctx) => …`. */
  animate?: AnimateProp | (() => AnimateProp);
}

interface Shape { key: string; si: number; label: string; radii: number[] }

const zeros = (n: number): number[] => new Array<number>(n).fill(0);

/** A closed Catmull-Rom curve through `pts` (the smooth radar shape). */
function closedSmooth(pts: readonly (readonly [number, number])[]): string {
  const n = pts.length;
  if (n < 3) return `M${pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join("L")}Z`;
  const q = (i: number): readonly [number, number] => pts[(i + n) % n] as readonly [number, number];
  let s = `M${f1(q(0)[0])},${f1(q(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = q(i - 1), p1 = q(i), p2 = q(i + 1), p3 = q(i + 2);
    s += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return `${s}Z`;
}

/** Text anchor for a label at angle `a` outside a circle: the side it sits on, mirrored for right-to-left text. */
const anchorAt = (a: number): string => {
  const s = Math.sin(a);
  if (Math.abs(s) < 0.2) return "middle";
  return (s > 0) !== (dir() === "rtl") ? "start" : "end";
};

/** Radar (spider) chart. See docs.md for props. */
export function RadarChart<D>(props: RadarChartProps<D>): Element {
  const size = useSize(props, 360, 300);
  const hidden = signal(new Set<string>()), active = signal(-1);
  const tip = tooltipState();
  const how = (): AnimateProp => animateOf(props.animate);
  let svg: Element | null = null;

  const rows = computed(() => rowsOf(props.data));
  const labelOf = computed(() => accessor<D>(props.x ?? "label"));
  const axes = computed(() => { const l = labelOf(); return rows().map((d, i) => String(l(d, i) ?? "")); });
  const series = computed(() => seriesOf(props.y ?? "value", props.series));
  const visible = computed(() => series().filter((s) => !hidden().has(s.key)));
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const values = computed(() => { const r = rows(); return series().map((s) => r.map((d, i) => num(s.get(d, i)))); });
  const perAxis = computed(() => read(props.scale) === "axis" || props.axisMax != null);
  // the rim value of every spoke; taken from every series (hiding one in the legend does not rescale the others)
  const maxes = computed((): number[] => {
    const r = rows(), vals = values();
    const top = (i?: number): number => Math.max(0, ...vals.flatMap((v) => (i == null ? v : [v[i]]).map((x) => x ?? 0)));
    if (perAxis()) {
      const am = props.axisMax != null ? accessor<D>(props.axisMax) : null;
      return r.map((d, i) => { const m = am ? num(am(d, i)) : null; return m && m > 0 ? m : top(i) || 1; });
    }
    const m = num(read(props.max)) ?? top();
    return r.map(() => (m > 0 ? m : 1));
  });
  const labelsOn = computed(() => read(props.axisLabels) !== false);
  const geo = computed(() => {
    const w = size.width(), hh = size.height();
    const lw = labelsOn() ? Math.min(96, Math.max(0, ...axes().map((a) => textWidth(a)))) + 12 : 8;
    return { cx: w / 2, cy: hh / 2, r: Math.max(12, Math.min(w / 2 - lw, hh / 2 - (labelsOn() ? 22 : 8))) };
  }, { equals: (a, b) => !!a && a.cx === b.cx && a.cy === b.cy && a.r === b.r });
  const n = computed(() => rows().length);
  const angle = (i: number): number => (i * TAU) / Math.max(1, n());
  const indices = computed(() => Array.from({ length: n() }, (_, i) => i));
  const levels = computed(() => Math.max(1, Math.round(num(read(props.levels)) ?? 4)));
  const levelList = computed(() => Array.from({ length: levels() }, (_, i) => i + 1));

  const shapes = computed((): Shape[] => {
    const g = geo(), vals = values(), mx = maxes();
    return visible().map((s) => ({ key: s.key, si: s.index, label: s.label, radii: (vals[s.index] ?? []).map((v, i) => f1(g.r * clamp((v ?? 0) / (mx[i] ?? 1), 0, 1))) }));
  });
  const pres = presence(shapes, (s) => s.key, how);

  const pointAt = (i: number): ChartPoint<D> => {
    const d = rows()[i] as D, vis = visible(), vals = values(), out: Record<string, number | null> = {};
    for (const s of vis) out[s.key] = vals[s.index]?.[i] ?? null;
    return { index: i, datum: d, x: axes()[i], label: axes()[i], values: out, series: vis[0]?.key ?? null, y: vis[0] ? (out[vis[0].key] ?? null) : null };
  };
  const show = (i: number): void => {
    active.set(i);
    const opt = read(props.tooltip);
    if (i < 0 || i >= n() || opt === false) return void tip.at.set(null);
    const p = pointAt(i), g = geo(), f = fmt(), sh = shapes();
    const reach = Math.max(g.r * 0.35, ...sh.map((s) => s.radii[i] ?? 0));
    const [x, y] = polar(g.cx, g.cy, reach, angle(i));
    const content = typeof opt === "function" ? () => opt(p)
      : () => tipBody(p.label, visible().map((s) => ({ label: s.label, value: perAxis() ? `${String(f(p.values[s.key]))} / ${String(f(maxes()[i]))}` : f(p.values[s.key]), index: s.index })), props.colors);
    showTip(tip, svg, size.width(), x, y, content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const select = (i = active.peek()): void => { if (i >= 0 && i < n()) props.onSelect?.(pointAt(i)); };
  const nearest = (e: PointerEvent): number => {
    const [x, y] = localPoint(svg, e, size.width()), g = geo();
    let a = Math.atan2(x - g.cx, g.cy - y);
    if (a < 0) a += TAU;
    return Math.round(a / (TAU / Math.max(1, n()))) % Math.max(1, n());
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const i = navIndex(e.key, active.peek(), 0, n() - 1);
    if (i == null || !n()) return;
    e.preventDefault();
    show(i);
  };

  const ring = (k: number): string => {
    const g = geo(), rr = (g.r * k) / levels();
    if (read(props.gridShape) === "circle") return `M${f1(g.cx)},${f1(g.cy - rr)}A${f1(rr)},${f1(rr)} 0 1 1 ${f1(g.cx)},${f1(g.cy + rr)}A${f1(rr)},${f1(rr)} 0 1 1 ${f1(g.cx)},${f1(g.cy - rr)}Z`;
    return polygonPath(g.cx, g.cy, zeros(Math.max(3, n())).map(() => rr));
  };
  const gridOn = (): boolean => read(props.grid) !== false;
  const fillOf = (): number => { const v = read(props.fill); return v === false ? 0 : v === true || v == null ? 0.22 : clamp(num(v) ?? 0.22, 0, 1); };

  const body = [
    h("g", { class: "m-radar-grid", "aria-hidden": "true", visibility: () => (gridOn() ? "visible" : "hidden") },
      each<number>({ each: levelList, children: (k) => h("path", { class: "m-radar-ring", d: attr(() => ring(k())) }) }),
      each<number>({ each: indices, children: (i) => h("line", {
        class: "m-radar-spoke", "class:m-chart-active": () => active() === i(),
        x1: () => geo().cx, y1: () => geo().cy,
        x2: attr(() => f1(polar(geo().cx, geo().cy, geo().r, angle(i()))[0])), y2: attr(() => f1(polar(geo().cx, geo().cy, geo().r, angle(i()))[1])),
      }) })),
    () => (read(props.levelLabels) && !perAxis() ? h("g", { class: "m-radar-levels", "aria-hidden": "true" },
      each<number>({ each: levelList, children: (k) => h("text", { class: "m-radar-level", x: () => f1(geo().cx + 4), y: attr(() => f1(geo().cy - (geo().r * k()) / levels())), dy: "-0.25em" },
        () => String(fmt()(((maxes()[0] ?? 1) * k()) / levels()))) })) : null),
    () => (labelsOn() ? h("g", { class: "m-radar-labels", "aria-hidden": "true" },
      each<number>({ each: indices, children: (i) => {
        const at = attr(() => { const g = geo(); return polar(g.cx, g.cy, g.r + 10, angle(i())); });
        return h("text", {
          class: "m-radar-label", "class:m-chart-active": () => active() === i(),
          x: () => f1(at()[0]), y: () => f1(at()[1]), "text-anchor": () => anchorAt(angle(i())),
          "dominant-baseline": () => { const c = Math.cos(angle(i())); return c > 0.5 ? "auto" : c < -0.5 ? "hanging" : "middle"; },
        }, () => axes()[i()] ?? "");
      } })) : null),
    h("g", { class: () => `m-chart-plot m-radar-plot${active() >= 0 ? " m-radar-focus" : ""}`, onPointerLeave: hide },
      h("circle", { class: "m-radar-hit", cx: () => geo().cx, cy: () => geo().cy, r: () => geo().r + 8,
        onPointerMove: (e: PointerEvent) => { const i = nearest(e); if (i !== active.peek()) show(i); }, onClick: (e: PointerEvent) => select(nearest(e)) }),
      each<Present<Shape>>({ each: pres.items, key: (s) => s.key, children: (s) => {
        const key = s().key;
        const t = tween(() => { const v = s(); return { radii: v.leaving ? zeros(v.radii.length) : v.radii }; }, ["radii"], how,
          (to) => ({ radii: zeros(to.radii.length) }),
          { index: () => s().si, key, leaving: () => !!s().leaving, onSettle: () => { if (s().leaving) pres.done(key); } });
        const pts = attr((): [number, number][] => { const g = geo(), r = t().radii, m = r.length; return r.map((v, i) => polar(g.cx, g.cy, v, (i * TAU) / Math.max(1, m))); });
        const count = attr(() => t().radii.length);
        const dotList = computed(() => Array.from({ length: count() }, (_, i) => i));
        return h("g", { class: () => `m-radar-series ${seriesClass(s().si)}`, "class:m-chart-leaving": () => !!s().leaving, style: () => colorStyle(props.colors, s().si) },
          h("path", { class: "m-radar-shape", style: () => ({ "--m-radar-fill": String(fillOf()) }),
            d: attr(() => (read(props.curve) === "smooth" ? closedSmooth(pts()) : polygonPath(geo().cx, geo().cy, t().radii))) }),
          () => (read(props.dots) === false ? null : each<number>({ each: dotList, children: (i) => h("circle", {
            class: "m-radar-dot", "class:m-chart-active": () => active() === i(),
            cx: attr(() => f1(pts()[i()]?.[0] ?? geo().cx)), cy: attr(() => f1(pts()[i()]?.[1] ?? geo().cy)), r: () => (active() === i() ? 5 : 3),
          }) })));
      } })),
  ];

  return Frame<D>(props, {
    kind: "radar", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => n() === 0, tip,
    legend: { items: () => { const l = read(props.legend); return l === false || (l == null && series().length < 2) ? [] : series(); }, hidden },
    table: {
      caption: () => read(props.title), rows,
      columns: () => [{ label: read(props.xLabel) ?? t`Axis`, value: (d: D, i: number) => labelOf()(d, i) },
        ...series().map((s) => ({ label: s.label, value: (d: D, i: number) => fmt()(num(s.get(d, i))) }))],
    },
  });
}
