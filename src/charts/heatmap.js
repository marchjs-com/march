// Heatmap: x × y grid of cells colored by value level (`hm-heat-0..4`), e.g. weekday × hour.
// `calendar` mode lays out daily values as weeks (columns) × weekdays (rows), e.g. the last 12 weeks.
import { signal, computed, read } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { For } from "../dom/flow.js";
import { applyPipe, toDate } from "../core/pipes.js";
import { locale } from "../core/i18n.ts";
import { rowsOf, accessor, formatter, num, useSize, attr, textWidth } from "./util.js";
import { Frame, tooltipState, showTip, tipBody, thin } from "./parts.js";

const DAY = 864e5;
const f1 = (v) => Math.round(v * 10) / 10;
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
/** Short weekday names, Monday first, in the active locale. */
const weekdays = () => { const f = new Intl.DateTimeFormat(locale(), { weekday: "short" }); return [...Array(7)].map((_, i) => f.format(new Date(2024, 0, 1 + i))); };

/** Level 0 (empty / ≤ 0) … levels-1 for a value relative to `max`. */
export function heatLevel(v, max, levels = 5) {
  if (v == null || !(v > 0) || !(max > 0)) return 0;
  return Math.max(1, Math.min(levels - 1, Math.ceil((v / max) * (levels - 1))));
}

/** Heatmap. See docs/charts.md for props. */
export function Heatmap(props) {
  const size = useSize(props, 640, 0);
  const active = signal(-1);
  const tip = tooltipState();
  let svg = null;

  const fmt = computed(() => formatter(read(props.format)));
  const levels = computed(() => num(read(props.levels)) ?? 5);
  // grid: { xs: [{key,label}], ys: [{key,label}], cells: [{key, xi, yi, value, label}] }
  const grid = computed(() => {
    const rows = rowsOf(props.data), gx = accessor(props.x ?? "x"), gy = accessor(props.y ?? "y"), gv = accessor(props.value ?? "value");
    const cal = read(props.calendar);
    if (cal) return calendarGrid(rows, gx, gv, cal === true ? {} : cal, read(props.end));
    const xf = formatter(read(props.xFormat), String), yf = formatter(read(props.yFormat), String);
    const xd = read(props.xDomain) ?? [...new Set(rows.map((d, i) => gx(d, i)))];
    const yd = read(props.yDomain) ?? [...new Set(rows.map((d, i) => gy(d, i)))];
    const xi = new Map(xd.map((v, i) => [v, i])), yi = new Map(yd.map((v, i) => [v, i]));
    const sums = new Map();
    rows.forEach((d, i) => {
      const a = xi.get(gx(d, i)), b = yi.get(gy(d, i));
      if (a == null || b == null) return;
      const k = b * xd.length + a, v = num(gv(d, i));
      if (v != null) sums.set(k, (sums.get(k) ?? 0) + v);
    });
    const cells = [];
    for (let b = 0; b < yd.length; b++) for (let a = 0; a < xd.length; a++) {
      const k = b * xd.length + a;
      cells.push({ key: `${String(xd[a])}|${String(yd[b])}`, xi: a, yi: b, value: sums.get(k) ?? null, label: `${yf(yd[b])} ${xf(xd[a])}` });
    }
    return { xs: xd.map((v) => ({ key: String(v), label: xf(v) })), ys: yd.map((v) => ({ key: String(v), label: yf(v) })), cells };
  });
  const max = computed(() => num(read(props.max)) ?? Math.max(0, ...grid().cells.map((c) => c.value ?? 0)));

  const ml = computed(() => Math.min(120, 8 + Math.max(0, ...grid().ys.map((y) => textWidth(y.label)))));
  const cell = computed(() => {
    const g = grid(), fixed = num(read(props.cell));
    return fixed ?? Math.max(4, Math.min(32, (size.width() - ml() - 8) / Math.max(1, g.xs.length)));
  });
  const height = computed(() => num(read(props.height)) ?? Math.ceil(22 + cell() * grid().ys.length + 4));
  const box = computed(() => ({ x: ml(), y: 22, w: cell() * grid().xs.length, h: cell() * grid().ys.length }));
  const gap = computed(() => (cell() > 8 ? 2 : 1));

  const xLabels = computed(() => { const g = grid(), c = cell(); return thin(g.xs.map((x, i) => ({ ...x, i })), Math.max(2, Math.floor(box().w / 36))).map((x) => ({ key: x.key, label: x.label, pos: f1(box().x + x.i * c + c / 2) })); });
  const yLabels = computed(() => { const c = cell(); return grid().ys.map((y, i) => ({ key: y.key, label: y.label, pos: f1(box().y + i * c + c / 2) })); });

  const pointAt = (k) => { const c = grid().cells[k]; return c && { index: k, x: grid().xs[c.xi].label, y: grid().ys[c.yi].label, value: c.value, label: c.label, datum: c }; };
  const show = (k) => {
    active.set(k);
    const opt = read(props.tooltip), c = grid().cells[k];
    if (!c || opt === false) return tip.at.set(null);
    const content = typeof opt === "function" ? () => opt(pointAt(k)) : () => tipBody(c.label, [{ label: read(props.valueLabel) ?? "Value", value: c.value == null ? "—" : fmt()(c.value), index: 0 }]);
    showTip(tip, svg, size.width(), box().x + (c.xi + 0.5) * cell(), box().y + c.yi * cell(), content);
  };
  const hide = () => { active.set(-1); tip.at.set(null); };
  const select = (k = active.peek()) => { const p = pointAt(k); if (p) props.onSelect?.(p); };
  const onKeyDown = (e) => {
    const g = grid(), nx = g.xs.length, n = g.cells.length;
    if (!n) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const i = Math.max(0, active.peek());
    const moves = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + nx, ArrowUp: i - nx, Home: 0, End: n - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    show(active.peek() < 0 ? 0 : Math.max(0, Math.min(n - 1, moves[e.key])));
  };

  const body = [
    h("g", { class: "hm-chart-axis hm-chart-axis-x", "aria-hidden": "true" },
      h(For, { each: xLabels, key: (t) => t.key }, (t) => h("text", { x: attr(() => t().pos), y: 14, "text-anchor": "middle" }, attr(() => t().label)))),
    h("g", { class: "hm-chart-axis hm-chart-axis-y", "aria-hidden": "true" },
      h(For, { each: yLabels, key: (t) => t.key }, (t) => h("text", { x: () => f1(ml() - 6), y: attr(() => t().pos), dy: "0.32em", "text-anchor": "end" }, attr(() => t().label)))),
    h("g", { class: "hm-chart-plot", transform: attr(() => `translate(${f1(box().x)},${box().y})`), onPointerLeave: hide },
      h(For, { each: () => grid().cells, key: (c) => c.key }, (c, i) => h("rect", {
        class: attr(() => `hm-heat-cell hm-heat-${heatLevel(c().value, max(), levels())}`), "class:hm-chart-active": () => active() === i(),
        x: attr(() => f1(c().xi * cell())), y: attr(() => f1(c().yi * cell())), width: attr(() => f1(Math.max(1, cell() - gap()))), height: attr(() => f1(Math.max(1, cell() - gap()))), rx: 2,
        onPointerEnter: () => show(i()), onClick: () => select(i()),
      }))),
  ];

  return Frame(props, {
    kind: "heatmap", size: { ...size, height }, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => grid().cells.length === 0, tip,
    table: {
      caption: () => read(props.title), rows: () => grid().ys,
      columns: () => { const g = grid(); return [{ label: "", value: (y) => y.label }, ...g.xs.map((x, a) => ({ label: x.label, value: (y, b) => { const c = g.cells[b * g.xs.length + a]; return c?.value == null ? "" : fmt()(c.value); } }))]; },
    },
  });
}

/** Weeks (columns, oldest first) × weekdays (rows, Monday first) ending at `end` (default: latest date in the data). */
function calendarGrid(rows, gx, gv, { weeks = 12 }, endProp) {
  const byDay = new Map();
  let last = null;
  rows.forEach((d, i) => {
    const t = toDate(gx(d, i));
    if (!t) return;
    const v = num(gv(d, i));
    byDay.set(dayKey(t), (byDay.get(dayKey(t)) ?? 0) + (v ?? 0));
    if (!last || t > last) last = t;
  });
  const end = toDate(endProp) ?? last ?? new Date();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const start = new Date(endDay);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);
  const xs = [], cells = [], names = weekdays();
  for (let w = 0; w < weeks; w++) { const d = new Date(start); d.setDate(d.getDate() + w * 7); xs.push({ key: dayKey(d), label: applyPipe("date", d, { month: "short", day: "numeric" }) }); }
  for (let wd = 0; wd < 7; wd++) for (let w = 0; w < weeks; w++) {
    const d = new Date(start);
    d.setDate(d.getDate() + w * 7 + wd);
    const future = d.getTime() > endDay.getTime() + DAY / 2;
    cells.push({ key: dayKey(d), xi: w, yi: wd, value: future ? null : byDay.get(dayKey(d)) ?? 0, label: applyPipe("date", d), future });
  }
  return { xs, ys: names.map((n, i) => ({ key: String(i), label: n })), cells };
}
