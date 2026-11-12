// LineChart and AreaChart: x (time / number / category) against one or more y series.
// Geometry is computed in `layout`; each series path binds `d` through a computed string, so only paths whose shape
// really changed touch the DOM. Long series are downsampled with LTTB above `maxPoints` (default 2 × plot width).
import { signal, computed, read, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { applyPipe } from "../core/pipes.ts";
import { scaleLinear, niceTicks, timeTicks } from "./scale.ts";
import { lttb } from "./lttb.ts";
import { rowsOf, accessor, formatter, num, seriesOf, seriesClass, colorStyle, xKind, timeMs, timeFormat, timeDetail, useSize, attr, textWidth, localPoint, navIndex, sameBox, each,
  type MaybeReactive, type DataProp, type Field, type SeriesSpec, type SeriesLabels, type FormatSpec, type Formatter, type ChartBaseProps, type ChartPoint, type TooltipProp, type Box, type Series, type XKind } from "./util.ts";
import { Frame, Axis, Grid, tooltipState, showTip, tipBody, thin, type Tick } from "./parts.ts";
import { clamp } from "../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

export interface XYChartProps<D = unknown> extends ChartBaseProps {
  data?: DataProp<D>;
  x?: Field<D> | undefined;
  y?: SeriesSpec<D> | readonly SeriesSpec<D>[] | undefined;
  series?: SeriesLabels | undefined;
  xType?: Opt<XKind>;
  xFormat?: Opt<FormatSpec>;
  format?: Opt<FormatSpec>;
  yMin?: Opt<number>;
  yMax?: Opt<number>;
  zero?: Opt<boolean>;
  grid?: Opt<boolean | "x" | "both">;
  maxPoints?: Opt<number>;
  zoom?: Opt<boolean>;
  xLabel?: Opt<string>;
  tooltip?: TooltipProp<ChartPoint<D>>;
  onSelect?: ((p: ChartPoint<D>) => void) | undefined;
}
export type LineChartProps<D = unknown> = XYChartProps<D>;
export interface AreaChartProps<D = unknown> extends XYChartProps<D> { stacked?: Opt<boolean> }
type Stack = Map<string, { lo: number[] | null; hi: (number | null)[] }>;

/** Line chart. See docs/charts.md for props. */
export function LineChart<D>(props: LineChartProps<D>): Element { return xyChart(props, "line"); }
/** Area chart (`stacked` stacks the visible series). */
export function AreaChart<D>(props: AreaChartProps<D>): Element { return xyChart(props, "area"); }

const M = { t: 12, r: 16, b: 28 };
const f1 = (v: number): number => Math.round(v * 10) / 10;

function xyChart<D>(props: AreaChartProps<D>, kind: "line" | "area"): Element {
  const size = useSize(props, 640, 240);
  const hidden = signal(new Set<string>()), active = signal(-1), zoom = signal<[number, number] | null>(null), drag = signal<[number, number] | null>(null);
  const tip = tooltipState();
  let svg: Element | null = null, dragged = false;

  const rows = computed(() => rowsOf(props.data));
  const series = computed(() => seriesOf(props.y, props.series));
  const visible = computed(() => series().filter((s) => !hidden().has(s.key)));
  const xRaw = computed(() => { const g = accessor<D>(props.x, (d, i) => i); return rows().map((d, i) => g(d, i)); });
  const xType = computed(() => xKind(xRaw(), read(props.xType)));
  const xNum = computed((): number[] => { const t = xType(), r = xRaw(); return t === "time" ? r.map(timeMs) : t === "linear" ? r.map(Number) : r.map((_, i) => i); });
  const sorted = computed(() => { const v = xNum(); for (let i = 1; i < v.length; i++) if ((v[i] as number) < (v[i - 1] as number)) return false; return true; });
  const range = computed((): [number, number] => { const n = rows().length, z = zoom(); return z ? [Math.max(0, z[0]), Math.min(n - 1, z[1])] : [0, n - 1]; }, { equals: (a, b) => !!a && a[0] === b[0] && a[1] === b[1] });
  const stacked = computed(() => kind === "area" && !!read(props.stacked));

  // per series: hi (value or stacked top) and lo (stacked base, or null)
  const stack = computed((): Stack => {
    const r = rows(), out: Stack = new Map();
    let base: number[] | null = null;
    for (const s of visible()) {
      const v = r.map((d, i) => num(s.get(d, i)));
      if (!stacked()) { out.set(s.key, { lo: null, hi: v }); continue; }
      const lo: number[] = base ?? v.map(() => 0), hi = v.map((x, i) => (lo[i] as number) + (x ?? 0));
      out.set(s.key, { lo, hi });
      base = hi;
    }
    return out;
  });

  const yFmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const yNice = computed(() => {
    const [a, b] = range(), st = stack();
    let lo = Infinity, hi = -Infinity;
    for (const { hi: v } of st.values()) for (let i = a; i <= b; i++) { const x = v[i]; if (x != null) { if (x < lo) lo = x; if (x > hi) hi = x; } }
    if (kind === "area" || read(props.zero)) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    lo = num(read(props.yMin)) ?? lo; hi = num(read(props.yMax)) ?? hi;
    return niceTicks(lo, hi, Math.max(2, Math.floor((size.height() - M.t - M.b) / 40)));
  });
  const box = computed((): Box => {
    const f = yFmt(), ml = Math.min(120, Math.max(32, 12 + Math.max(0, ...yNice().ticks.map((t) => textWidth(f(t))))));
    return { x: ml, y: M.t, w: Math.max(10, size.width() - ml - M.r), h: Math.max(10, size.height() - M.t - M.b) };
  }, { equals: sameBox });
  const ys = computed(() => scaleLinear([yNice().min, yNice().max], [box().h, 0]));
  const xDomain = computed((): [number, number] => {
    const [a, b] = range(), v = xNum();
    let lo = Infinity, hi = -Infinity;
    for (let i = a; i <= b; i++) { const x = v[i] as number; if (x < lo) lo = x; if (x > hi) hi = x; }
    return isFinite(lo) ? [lo, hi] : [0, 1];
  });
  const xs = computed(() => scaleLinear(xDomain(), [0, box().w]));
  // xFmt formats one value (tooltip, table); xTickFmt formats axis ticks (time ticks depend on the visible span)
  const xFormatOf = (time: (spanMs: number) => Formatter) => computed((): Formatter => {
    const f = read<FormatSpec | null | undefined>(props.xFormat);
    if (f != null) return formatter(f);
    const t = xType();
    if (t === "time") { const [lo, hi] = xDomain(); return time(hi - lo); }
    return t === "band" ? (v) => String(v ?? "") : (v) => applyPipe("number", v);
  });
  const xFmt = xFormatOf(timeDetail), xTickFmt = xFormatOf(timeFormat);

  const xTicks = computed((): Tick[] => {
    const n = Math.max(2, Math.floor(box().w / 90)), s = xs(), f = xTickFmt(), t = xType(), [lo, hi] = xDomain();
    if (t === "time") return timeTicks(lo, hi, n).map((v) => ({ key: v, pos: s(v), label: f(v) }));
    if (t === "linear") return s.ticks(n).map((v) => ({ key: v, pos: s(v), label: f(v) }));
    const [a, b] = range(), raw = xRaw(), idx: number[] = [];
    for (let i = a; i <= b; i++) idx.push(i);
    return thin(idx, n).map((i) => ({ key: i, pos: s(i), label: f(raw[i]) }));
  });
  const grid = computed(() => read(props.grid) ?? true);
  const yTicks = computed((): Tick[] => { const s = ys(), f = yFmt(); return yNice().ticks.map((v) => ({ key: v, pos: s(v), label: f(v) })); });

  const maxPoints = computed(() => num(read(props.maxPoints)) ?? Math.max(64, Math.round(box().w * 2)));
  const layout = computed(() => {
    const [a, b] = range(), xv = xNum(), sx = xs(), sy = ys(), lim = maxPoints(), out = new Map<string, { line: string; area: string }>();
    const y0 = sy(clamp(0, yNice().min, yNice().max));
    for (const s of visible()) {
      const { lo, hi } = stack().get(s.key) as { lo: number[] | null; hi: (number | null)[] };
      const X = (i: number): number => xv[i] as number, Y = (i: number): number => hi[i] as number;
      const segs = segments(a, b, xv, hi);
      const total = segs.reduce((n, g) => n + g.length, 0);
      const parts = total > lim ? segs.map((g) => lttb(g, Math.max(3, Math.round((g.length * lim) / total)), X, Y)) : segs;
      let line = "", area = "";
      for (const g of parts) {
        const top = g.map((i) => `${f1(sx(X(i)))},${f1(sy(Y(i)))}`).join("L");
        line += `M${top}`;
        if (kind === "area") area += `M${top}L${g.slice().reverse().map((i) => `${f1(sx(X(i)))},${f1(lo ? sy(lo[i]) : y0)}`).join("L")}Z`;
      }
      out.set(s.key, { line, area });
    }
    return out;
  });

  // ---- interaction
  const pointAt = (i: number): ChartPoint<D> => {
    const d = rows()[i], vis = visible(), values: Record<string, number | null> = {};
    for (const s of vis) values[s.key] = num(s.get(d as D, i));
    return { index: i, datum: d, x: xRaw()[i], label: xFmt()(xRaw()[i]), values, series: vis[0]?.key ?? null, y: vis[0] ? values[vis[0].key] : null };
  };
  const nearest = (px: number): number => {
    const [a, b] = range(), v = xNum(), t = xs().invert(px);
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
  const show = (i: number): void => {
    active.set(i);
    const opt = read(props.tooltip);
    if (i < 0 || opt === false) return void tip.at.set(null);
    const p = pointAt(i), st = stack(), bx = box(), f = yFmt();
    const top = Math.min(...visible().map((s: Series<D>) => ys()(st.get(s.key)?.hi[i] ?? yNice().max)), bx.h);
    const content = typeof opt === "function" ? () => opt(p)
      : () => tipBody(p.label, visible().map((s) => ({ label: s.label, value: f(p.values[s.key]), index: s.index })), props.colors);
    showTip(tip, svg, size.width(), bx.x + xs()(xNum()[i]), bx.y + top, content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const px = (e: PointerEvent): number => localPoint(svg, e, size.width())[0] - box().x;
  const clampX = (p: number): number => clamp(p, 0, box().w);
  const select = (): void => { const i = active.peek(); if (i >= 0) props.onSelect?.(pointAt(i)); };

  const handlers = {
    onPointerDown: (e: PointerEvent) => { if (read(props.zoom)) { const p = clampX(px(e)); drag.set([p, p]); dragged = false; } },
    onPointerMove: (e: PointerEvent) => { const d = drag.peek(); if (d) { drag.set([d[0], clampX(px(e))]); return; } show(nearest(px(e))); },
    onPointerUp: () => {
      const d = drag.peek();
      if (!d) return;
      drag.set(null);
      if (Math.abs(d[1] - d[0]) < 4) return;
      dragged = true;
      const i0 = nearest(Math.min(...d)), i1 = nearest(Math.max(...d));
      if (i1 - i0 >= 2) { zoom.set([i0, i1]); hide(); }
    },
    onPointerLeave: () => { if (!drag.peek()) hide(); },
    onClick: () => { if (!dragged) select(); dragged = false; },
    onDblClick: () => { zoom.set(null); hide(); },
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); return select(); }
    if (e.key === "Escape") { if (zoom.peek()) zoom.set(null); return hide(); }
    const [a, b] = range();
    const i = navIndex(e.key, active.peek(), a, b);
    if (i == null || b < a) return;
    e.preventDefault();
    show(i);
  };

  const focusX = attr(() => { const i = active(); return i < 0 ? 0 : f1(box().x + xs()(xNum()[i])); });
  const body = [
    Grid({ dir: "h", ticks: () => (grid() ? yTicks() : []), box }),
    Grid({ dir: "v", ticks: () => (grid() === "both" || grid() === "x" ? xTicks() : []), box }),
    Axis({ side: "left", ticks: yTicks, box }),
    Axis({ side: "bottom", ticks: xTicks, box }),
    h("g", { class: "hm-chart-plot", transform: attr(() => `translate(${box().x},${box().y})`) },
      each<Series<D>>({ each: visible, key: (s) => s.key, children: (s) => {
        const key = s().key, geo = attr(() => layout().get(key));
        return h("g", { class: () => `hm-chart-series ${seriesClass(s().index)}`, style: () => colorStyle(props.colors, s().index), "data-series": key },
          kind === "area" ? h("path", { class: "hm-chart-area", d: attr(() => geo()?.area ?? "") }) : null,
          h("path", { class: "hm-chart-line", d: attr(() => geo()?.line ?? "") }));
      } })),
    h("g", { class: "hm-chart-focus", visibility: () => (active() >= 0 ? "visible" : "hidden"), transform: () => `translate(${focusX()},${box().y})` },
      h("line", { class: "hm-chart-guide", y1: 0, y2: attr(() => box().h) }),
      each<Series<D>>({ each: visible, key: (s) => s.key, children: (s) => {
        const cy = attr(() => { const i = active(), v = i < 0 ? null : stack().get(s().key)?.hi[i]; return v == null ? null : f1(ys()(v)); });
        return h("circle", { class: () => `hm-chart-marker ${seriesClass(s().index)}`, style: () => colorStyle(props.colors, s().index), r: 4, cx: 0, cy, visibility: () => (cy() == null ? "hidden" : "visible") });
      } })),
    h("rect", { class: "hm-chart-brush", visibility: () => (drag() ? "visible" : "hidden"), y: () => box().y, height: () => box().h,
      x: () => box().x + Math.min(...(drag() ?? [0])), width: () => { const d = drag(); return d ? Math.abs(d[1] - d[0]) : 0; } }),
    h("rect", { class: "hm-chart-overlay", x: () => box().x, y: () => box().y, width: () => box().w, height: () => box().h, ...handlers }),
  ];

  const xLabel = (): unknown => read(props.xLabel) ?? (typeof props.x === "string" ? props.x : "x");
  return Frame<D>(props, {
    kind, size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => rows().length === 0,
    tip,
    legend: { items: () => { const l = read(props.legend); return l === false || (l == null && series().length < 2) ? [] : series(); }, hidden },
    table: {
      caption: () => read(props.title),
      rows,
      columns: () => [{ label: xLabel(), value: (_d: D, i: number) => untrack(xFmt)(xRaw.peek()[i]) },
        ...series().map((s) => ({ label: s.label, value: (d: D, i: number) => untrack(yFmt)(num(s.get(d, i))) }))],
    },
    extra: [h("button", { type: "button", class: "hm-chart-reset", hidden: () => !zoom(), onClick: () => { zoom.set(null); hide(); } }, "Reset zoom")],
  });
}

/** Runs of consecutive indices in a..b with a finite x and a non-null value (null values become gaps). */
function segments(a: number, b: number, xv: readonly number[], val: readonly (number | null)[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  for (let i = a; i <= b; i++) {
    if (val[i] == null || !isFinite(xv[i] as number)) { if (cur.length) out.push(cur), (cur = []); } else cur.push(i);
  }
  if (cur.length) out.push(cur);
  return out;
}
