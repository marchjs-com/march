// LineChart and AreaChart: x (time / number / category) against one or more y series.
// Geometry is computed in `layout`; each series path binds `d` through a computed string, so only paths whose shape
// really changed touch the DOM. Long series are downsampled with LTTB above `maxPoints` (default 2 × plot width).
import { signal, computed, read, untrack } from "../core/reactive.js";
import { h } from "../dom/h.js";
import { For } from "../dom/flow.js";
import { applyPipe } from "../core/pipes.js";
import { scaleLinear, niceTicks, timeTicks } from "./scale.js";
import { lttb } from "./lttb.js";
import { rowsOf, accessor, formatter, num, seriesOf, seriesClass, colorStyle, xKind, timeMs, timeFormat, timeDetail, useSize, attr, textWidth, localPoint, navIndex, sameBox } from "./util.js";
import { Frame, Axis, Grid, tooltipState, showTip, tipBody, thin } from "./parts.js";

/** Line chart. See docs/charts.md for props. */
export function LineChart(props) { return xyChart(props, "line"); }
/** Area chart (`stacked` stacks the visible series). */
export function AreaChart(props) { return xyChart(props, "area"); }

const M = { t: 12, r: 16, b: 28 };
const f1 = (v) => Math.round(v * 10) / 10;

function xyChart(props, kind) {
  const size = useSize(props, 640, 240);
  const hidden = signal(new Set()), active = signal(-1), zoom = signal(null), drag = signal(null);
  const tip = tooltipState();
  let svg = null, dragged = false;

  const rows = computed(() => rowsOf(props.data));
  const series = computed(() => seriesOf(props.y, props.series));
  const visible = computed(() => series().filter((s) => !hidden().has(s.key)));
  const xRaw = computed(() => { const g = accessor(props.x, (d, i) => i); return rows().map((d, i) => g(d, i)); });
  const xType = computed(() => xKind(xRaw(), read(props.xType)));
  const xNum = computed(() => { const t = xType(), r = xRaw(); return t === "time" ? r.map(timeMs) : t === "linear" ? r.map(Number) : r.map((_, i) => i); });
  const sorted = computed(() => { const v = xNum(); for (let i = 1; i < v.length; i++) if (v[i] < v[i - 1]) return false; return true; });
  const range = computed(() => { const n = rows().length, z = zoom(); return z ? [Math.max(0, z[0]), Math.min(n - 1, z[1])] : [0, n - 1]; }, { equals: (a, b) => !!a && a[0] === b[0] && a[1] === b[1] });
  const stacked = computed(() => kind === "area" && !!read(props.stacked));

  // per series: hi (value or stacked top) and lo (stacked base, or null)
  const stack = computed(() => {
    const r = rows(), out = new Map();
    let base = null;
    for (const s of visible()) {
      const v = r.map((d, i) => num(s.get(d, i)));
      if (!stacked()) { out.set(s.key, { lo: null, hi: v }); continue; }
      const lo = base ?? v.map(() => 0), hi = v.map((x, i) => lo[i] + (x ?? 0));
      out.set(s.key, { lo, hi });
      base = hi;
    }
    return out;
  });

  const yFmt = computed(() => formatter(read(props.format)));
  const yNice = computed(() => {
    const [a, b] = range(), st = stack();
    let lo = Infinity, hi = -Infinity;
    for (const { hi: v } of st.values()) for (let i = a; i <= b; i++) { const x = v[i]; if (x != null) { if (x < lo) lo = x; if (x > hi) hi = x; } }
    if (kind === "area" || read(props.zero)) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    lo = num(read(props.yMin)) ?? lo; hi = num(read(props.yMax)) ?? hi;
    return niceTicks(lo, hi, Math.max(2, Math.floor((size.height() - M.t - M.b) / 40)));
  });
  const box = computed(() => {
    const f = yFmt(), ml = Math.min(120, Math.max(32, 12 + Math.max(0, ...yNice().ticks.map((t) => textWidth(f(t))))));
    return { x: ml, y: M.t, w: Math.max(10, size.width() - ml - M.r), h: Math.max(10, size.height() - M.t - M.b) };
  }, { equals: sameBox });
  const ys = computed(() => scaleLinear([yNice().min, yNice().max], [box().h, 0]));
  const xDomain = computed(() => {
    const [a, b] = range(), v = xNum();
    let lo = Infinity, hi = -Infinity;
    for (let i = a; i <= b; i++) { if (v[i] < lo) lo = v[i]; if (v[i] > hi) hi = v[i]; }
    return isFinite(lo) ? [lo, hi] : [0, 1];
  });
  const xs = computed(() => scaleLinear(xDomain(), [0, box().w]));
  // xFmt formats one value (tooltip, table); xTickFmt formats axis ticks (time ticks depend on the visible span)
  const xFormatOf = (time) => computed(() => {
    const f = read(props.xFormat);
    if (f != null) return formatter(f);
    const t = xType();
    if (t === "time") { const [lo, hi] = xDomain(); return time(hi - lo); }
    return t === "band" ? (v) => String(v ?? "") : (v) => applyPipe("number", v);
  });
  const xFmt = xFormatOf(timeDetail), xTickFmt = xFormatOf(timeFormat);

  const xTicks = computed(() => {
    const n = Math.max(2, Math.floor(box().w / 90)), s = xs(), f = xTickFmt(), t = xType(), [lo, hi] = xDomain();
    if (t === "time") return timeTicks(lo, hi, n).map((v) => ({ key: v, pos: s(v), label: f(v) }));
    if (t === "linear") return s.ticks(n).map((v) => ({ key: v, pos: s(v), label: f(v) }));
    const [a, b] = range(), raw = xRaw(), idx = [];
    for (let i = a; i <= b; i++) idx.push(i);
    return thin(idx, n).map((i) => ({ key: i, pos: s(i), label: f(raw[i]) }));
  });
  const grid = computed(() => read(props.grid) ?? true);
  const yTicks = computed(() => { const s = ys(), f = yFmt(); return yNice().ticks.map((v) => ({ key: v, pos: s(v), label: f(v) })); });

  const maxPoints = computed(() => num(read(props.maxPoints)) ?? Math.max(64, Math.round(box().w * 2)));
  const layout = computed(() => {
    const [a, b] = range(), xv = xNum(), sx = xs(), sy = ys(), lim = maxPoints(), out = new Map();
    const y0 = sy(Math.max(yNice().min, Math.min(yNice().max, 0)));
    for (const s of visible()) {
      const { lo, hi } = stack().get(s.key);
      const segs = segments(a, b, xv, hi);
      const total = segs.reduce((n, g) => n + g.length, 0);
      const parts = total > lim ? segs.map((g) => lttb(g, Math.max(3, Math.round((g.length * lim) / total)), (i) => xv[i], (i) => hi[i])) : segs;
      let line = "", area = "";
      for (const g of parts) {
        const top = g.map((i) => `${f1(sx(xv[i]))},${f1(sy(hi[i]))}`).join("L");
        line += `M${top}`;
        if (kind === "area") area += `M${top}L${g.slice().reverse().map((i) => `${f1(sx(xv[i]))},${f1(lo ? sy(lo[i]) : y0)}`).join("L")}Z`;
      }
      out.set(s.key, { line, area });
    }
    return out;
  });

  // ---- interaction
  const pointAt = (i) => {
    const d = rows()[i], vis = visible(), values = {};
    for (const s of vis) values[s.key] = num(s.get(d, i));
    return { index: i, datum: d, x: xRaw()[i], label: xFmt()(xRaw()[i]), values, series: vis[0]?.key ?? null, y: vis[0] ? values[vis[0].key] : null };
  };
  const nearest = (px) => {
    const [a, b] = range(), v = xNum(), t = xs().invert(px);
    if (b < a) return -1;
    if (sorted()) {
      let lo = a, hi = b;
      while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < t) lo = m + 1; else hi = m; }
      return lo > a && Math.abs(v[lo - 1] - t) <= Math.abs(v[lo] - t) ? lo - 1 : lo;
    }
    let best = a;
    for (let i = a; i <= b; i++) if (Math.abs(v[i] - t) < Math.abs(v[best] - t)) best = i;
    return best;
  };
  const show = (i) => {
    active.set(i);
    const opt = read(props.tooltip);
    if (i < 0 || opt === false) return tip.at.set(null);
    const p = pointAt(i), st = stack(), bx = box(), f = yFmt();
    const top = Math.min(...visible().map((s) => ys()(st.get(s.key).hi[i] ?? yNice().max)), bx.h);
    const content = typeof opt === "function" ? () => opt(p)
      : () => tipBody(p.label, visible().map((s) => ({ label: s.label, value: f(p.values[s.key]), index: s.index })), props.colors);
    showTip(tip, svg, size.width(), bx.x + xs()(xNum()[i]), bx.y + top, content);
  };
  const hide = () => { active.set(-1); tip.at.set(null); };
  const px = (e) => localPoint(svg, e, size.width())[0] - box().x;
  const clampX = (p) => Math.max(0, Math.min(box().w, p));
  const select = () => { const i = active.peek(); if (i >= 0) props.onSelect?.(pointAt(i)); };

  const handlers = {
    onPointerDown: (e) => { if (read(props.zoom)) { const p = clampX(px(e)); drag.set([p, p]); dragged = false; } },
    onPointerMove: (e) => { const d = drag.peek(); if (d) { drag.set([d[0], clampX(px(e))]); return; } show(nearest(px(e))); },
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
  const onKeyDown = (e) => {
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
      h(For, { each: visible, key: (s) => s.key }, (s) => {
        const key = s().key, geo = attr(() => layout().get(key));
        return h("g", { class: () => `hm-chart-series ${seriesClass(s().index)}`, style: () => colorStyle(props.colors, s().index), "data-series": key },
          kind === "area" ? h("path", { class: "hm-chart-area", d: attr(() => geo()?.area ?? "") }) : null,
          h("path", { class: "hm-chart-line", d: attr(() => geo()?.line ?? "") }));
      })),
    h("g", { class: "hm-chart-focus", visibility: () => (active() >= 0 ? "visible" : "hidden"), transform: () => `translate(${focusX()},${box().y})` },
      h("line", { class: "hm-chart-guide", y1: 0, y2: attr(() => box().h) }),
      h(For, { each: visible, key: (s) => s.key }, (s) => {
        const cy = attr(() => { const i = active(), v = i < 0 ? null : stack().get(s().key)?.hi[i]; return v == null ? null : f1(ys()(v)); });
        return h("circle", { class: () => `hm-chart-marker ${seriesClass(s().index)}`, style: () => colorStyle(props.colors, s().index), r: 4, cx: 0, cy, visibility: () => (cy() == null ? "hidden" : "visible") });
      })),
    h("rect", { class: "hm-chart-brush", visibility: () => (drag() ? "visible" : "hidden"), y: () => box().y, height: () => box().h,
      x: () => box().x + Math.min(...(drag() ?? [0])), width: () => { const d = drag(); return d ? Math.abs(d[1] - d[0]) : 0; } }),
    h("rect", { class: "hm-chart-overlay", x: () => box().x, y: () => box().y, width: () => box().w, height: () => box().h, ...handlers }),
  ];

  const xLabel = () => read(props.xLabel) ?? (typeof props.x === "string" ? props.x : "x");
  return Frame(props, {
    kind, size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => rows().length === 0,
    tip,
    legend: { items: () => { const l = read(props.legend); return l === false || (l == null && series().length < 2) ? [] : series(); }, hidden },
    table: {
      caption: () => read(props.title),
      rows,
      columns: () => [{ label: xLabel(), value: (d, i) => untrack(xFmt)(xRaw.peek()[i]) },
        ...series().map((s) => ({ label: s.label, value: (d, i) => untrack(yFmt)(num(s.get(d, i))) }))],
    },
    extra: [h("button", { type: "button", class: "hm-chart-reset", hidden: () => !zoom(), onClick: () => { zoom.set(null); hide(); } }, "Reset zoom")],
  });
}

/** Runs of consecutive indices in a..b with a finite x and a non-null value (null values become gaps). */
function segments(a, b, xv, val) {
  const out = [];
  let cur = [];
  for (let i = a; i <= b; i++) {
    if (val[i] == null || !isFinite(xv[i])) { if (cur.length) out.push(cur), (cur = []); } else cur.push(i);
  }
  if (cur.length) out.push(cur);
  return out;
}
