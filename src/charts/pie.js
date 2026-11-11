// PieChart (and donut): one slice per row, `x` = label key, `y` = value key. Slices are keyed by label.
import { signal, computed, read } from "../core/reactive.ts";
import { h } from "../dom/h.js";
import { For } from "../dom/flow.js";
import { applyPipe } from "../core/pipes.js";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, useSize, attr, navIndex } from "./util.js";
import { Frame, tooltipState, showTip, tipBody } from "./parts.js";

const TAU = Math.PI * 2;
const f2 = (v) => Math.round(v * 100) / 100;

/** Angles (radians, clockwise from 12 o'clock) for non-negative values. Returns [{start, end, value, share}]. */
export function pieLayout(values, { padAngle = 0 } = {}) {
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
export function arcPath(cx, cy, r, r0, a0, a1) {
  const pt = (rad, a) => `${f2(cx + rad * Math.sin(a))},${f2(cy - rad * Math.cos(a))}`;
  if (a1 - a0 >= TAU - 1e-9) { // full circle: two half arcs
    const ring = (rad, sweep) => `M${pt(rad, 0)}A${rad},${rad} 0 1 ${sweep} ${pt(rad, Math.PI)}A${rad},${rad} 0 1 ${sweep} ${pt(rad, 0)}Z`;
    return ring(r, 1) + (r0 > 0 ? ring(r0, 0) : "");
  }
  if (a1 <= a0) return "";
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const outer = `M${pt(r, a0)}A${r},${r} 0 ${large} 1 ${pt(r, a1)}`;
  return r0 > 0 ? `${outer}L${pt(r0, a1)}A${r0},${r0} 0 ${large} 0 ${pt(r0, a0)}Z` : `${outer}L${f2(cx)},${f2(cy)}Z`;
}

/** Pie / donut chart. See docs/charts.md for props. */
export function PieChart(props) {
  const size = useSize(props, 320, 240);
  const hidden = signal(new Set()), active = signal(-1);
  const tip = tooltipState();
  let svg = null;

  const rows = computed(() => rowsOf(props.data));
  const label = computed(() => accessor(props.x ?? "label"));
  const value = computed(() => accessor(Array.isArray(props.y) ? props.y[0] : props.y ?? "value"));
  const fmt = computed(() => formatter(read(props.format)));
  const items = computed(() => { const l = label(), v = value(); return rows().map((d, i) => ({ key: String(l(d, i)), label: String(l(d, i)), index: i, value: num(v(d, i)) ?? 0, datum: d })); });
  const shown = computed(() => items().filter((s) => !hidden().has(s.key)));
  const total = computed(() => shown().reduce((a, s) => a + Math.max(0, s.value), 0));
  const geo = computed(() => {
    const w = size.width(), hh = size.height(), r = Math.max(4, Math.min(w, hh) / 2 - 8);
    const d = read(props.donut), ratio = d === true ? 0.6 : num(d) ?? 0;
    return { cx: w / 2, cy: hh / 2, r, r0: r * Math.max(0, Math.min(0.95, ratio)) };
  });
  const slices = computed(() => {
    const list = shown(), lay = pieLayout(list.map((s) => s.value), { padAngle: num(read(props.padAngle)) ?? (list.length > 1 ? 0.01 : 0) });
    const g = geo();
    return list.map((s, i) => ({ ...s, ...lay[i], d: arcPath(g.cx, g.cy, g.r, g.r0, lay[i].start, lay[i].end) }));
  });

  const pointAt = (k) => { const s = slices()[k]; return s && { index: s.index, datum: s.datum, label: s.label, x: s.label, y: s.value, value: s.value, share: s.share }; };
  const show = (k) => {
    active.set(k);
    const opt = read(props.tooltip), s = slices()[k];
    if (!s || opt === false) return tip.at.set(null);
    const g = geo(), mid = (s.start + s.end) / 2, rr = (g.r + g.r0) / 2 || g.r / 2;
    const content = typeof opt === "function" ? () => opt(pointAt(k))
      : () => tipBody(s.label, [{ label: applyPipe("percent", s.share, 1), value: fmt()(s.value), index: s.index }], props.colors);
    showTip(tip, svg, size.width(), g.cx + rr * Math.sin(mid), g.cy - rr * Math.cos(mid), content);
  };
  const hide = () => { active.set(-1); tip.at.set(null); };
  const select = (k = active.peek()) => { const p = pointAt(k); if (p) props.onSelect?.(p); };
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const k = navIndex(e.key, active.peek(), 0, slices().length - 1);
    if (k == null || !slices().length) return;
    e.preventDefault();
    show(k);
  };
  const activeKey = () => slices()[active()]?.key;

  const body = [
    h("g", { class: "hm-chart-plot", onPointerLeave: hide },
      h(For, { each: slices, key: (s) => s.key }, (s) => h("path", {
        class: () => `hm-chart-slice ${seriesClass(s().index)}`, "class:hm-chart-active": () => activeKey() === s().key,
        style: () => colorStyle(props.colors, s().index), d: attr(() => s().d),
        onPointerEnter: () => show(slices().findIndex((x) => x.key === s().key)),
        onClick: () => select(slices().findIndex((x) => x.key === s().key)),
      }))),
    () => (geo().r0 > 0 ? h("text", { class: "hm-chart-center", x: () => geo().cx, y: () => geo().cy, "text-anchor": "middle", "dominant-baseline": "middle" },
      () => { const c = read(props.center); return c ?? fmt()(total()); }) : null),
  ];

  return Frame(props, {
    kind: "pie", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => total() === 0 && hidden().size === 0, tip,
    legend: { items: () => (read(props.legend) === false ? [] : items()), hidden },
    table: {
      caption: () => read(props.title), rows,
      columns: () => [{ label: read(props.xLabel) ?? "Label", value: (d, i) => label()(d, i) },
        { label: read(props.yLabel) ?? "Value", value: (d, i) => fmt()(num(value()(d, i))) }],
    },
  });
}
