// Chart parts: frame (wrapper + accessible svg), axes, grid, legend with series toggle, tooltip, hidden data table.
import { signal, read, untrack, type Signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { nextId, seriesClass, colorStyle, toggleIn, attr, each, type Box, type ChartBaseProps, type Size } from "./util.ts";
import type { Handler } from "../core/util.ts";
import type { ExportProp } from "./tools.ts";

// The export toolbar is its own chunk: only a chart with `export` loads it (a plain import(), no lazy() wrapper, so a
// chart without export pays nothing for it).
type ToolsFn = (o: { root: () => Element | null; spec: () => ExportProp; title: () => unknown }) => Element;
const tools = signal<{ fn: ToolsFn } | null>(null);
let toolsLoading = false;
const loadTools = (): void => { if (toolsLoading) return; toolsLoading = true; void import("./tools.ts").then((m) => tools.set({ fn: m.ChartTools })); };

/** Tooltip position (CSS px relative to the wrapper) and lazily rendered content. */
export interface TipAt { x: number; y: number; left: boolean; content: () => unknown }
export interface TipState { at: Signal<TipAt | null> }
/** One legend entry (a series or a pie slice). */
export interface LegendItem { key: string; label: unknown; index: number }
/** An axis / grid tick. */
export interface Tick { key: string | number; pos: number; label: unknown }
export interface DataColumn<R> { label: unknown; value: (d: R, i: number) => unknown }
export interface DataTableOptions<R> { caption: () => unknown; columns: () => readonly DataColumn<R>[]; rows: () => readonly R[]; limit?: number }
export interface FrameOptions<R> {
  kind: string;
  size: Size;
  body: unknown[];
  empty?: () => boolean;
  onKeyDown?: Handler<[e: KeyboardEvent]> | undefined;
  svgRef?: (el: Element) => void;
  tip?: TipState;
  legend?: { items: () => readonly LegendItem[]; hidden: Signal<Set<string>> };
  table?: DataTableOptions<R>;
  extra?: unknown[];
}

/**
 * Wrapper `div.m-chart` with an `svg role="img"` (title/desc via aria-labelledby), then tooltip, legend and data table.
 * `props`: component props (title, description, legend, tooltip, empty, colors, class).
 */
export function Frame<R>(props: ChartBaseProps, o: FrameOptions<R>): Element {
  const id = nextId();
  const { width, height, responsive, observe } = o.size;
  const legendPos = (): "right" | "bottom" => { const l = read(props.legend); return l === "right" ? "right" : "bottom"; };
  let root: Element | null = null;
  return h("div", { class: () => ["m-chart", `m-${o.kind}-chart`, o.legend && `m-chart-legend-at-${legendPos()}`, read(props.class)].filter(Boolean).join(" "), ref: (el: Element) => { root = el; observe(el); } },
    h("svg", {
      class: "m-chart-svg", role: "img", "aria-labelledby": `${id}-t ${id}-d`, tabindex: o.onKeyDown ? "0" : null, focusable: o.onKeyDown ? "true" : "false",
      viewBox: () => `0 0 ${width()} ${height()}`, preserveAspectRatio: "xMinYMin meet",
      width: () => (responsive() ? "100%" : width()), height: () => (responsive() ? null : height()),
      ref: o.svgRef, onKeyDown: o.onKeyDown,
    },
    h("title", { id: `${id}-t` }, () => read(props.title) ?? "Chart"),
    h("desc", { id: `${id}-d` }, () => read(props.description) ?? ""),
    ...o.body,
    () => (o.empty?.() ? h("text", { class: "m-chart-empty", x: () => width() / 2, y: () => height() / 2, "text-anchor": "middle", "dominant-baseline": "middle" }, () => read(props.empty) ?? "No data") : null)),
    ...(o.extra ?? []),
    () => { if (!read(props.export)) return null; const T = tools(); if (!T) { loadTools(); return null; } return untrack(() => T.fn({ root: () => root, spec: () => read(props.export), title: () => read(props.title) })); },
    o.tip ? Tooltip(o.tip) : null,
    o.legend ? Legend({ ...o.legend, position: legendPos, colors: () => props.colors }) : null,
    o.table ? DataTable(o.table) : null);
}

/** Tooltip state: `{ at: signal(null | {x, y, left, content: () => node}) }`; x/y are CSS px relative to the wrapper. */
export const tooltipState = (): TipState => ({ at: signal<TipAt | null>(null) });

/** Show the tooltip at a point in viewBox units (scaled to the rendered size of the svg). */
export function showTip(tip: TipState, svg: Element | null, width: number, x: number, y: number, content: () => unknown): void {
  const r = svg?.getBoundingClientRect?.();
  const k = r?.width ? r.width / width : 1;
  tip.at.set({ x: x * k, y: y * k, left: x > width * 0.6, content });
}

function Tooltip(tip: TipState): Element {
  return h("div", {
    class: "m-chart-tooltip", role: "status", "aria-live": "polite", hidden: () => !tip.at(), "class:m-chart-tooltip-left": () => tip.at()?.left,
    style: () => { const t = tip.at(); return t ? { left: `${Math.round(t.x)}px`, top: `${Math.round(t.y)}px` } : {}; },
  }, () => { const t = tip.at(); return t ? untrack(t.content) : null; });
}

/** One tooltip row. */
export interface TipRow { label: unknown; value: unknown; index: number }
/** Default tooltip body: a heading and one row per series `{label, value, index}`. */
export function tipBody(title: unknown, rows: readonly TipRow[], colors?: ChartBaseProps["colors"]): Element {
  return h("div", { class: "m-chart-tip" },
    title != null && title !== "" ? h("div", { class: "m-chart-tip-title" }, String(title)) : null,
    ...rows.map((r) => h("div", { class: `m-chart-tip-row ${seriesClass(r.index)}`, style: colorStyle(colors, r.index) },
      h("span", { class: "m-chart-swatch", "aria-hidden": "true" }),
      h("span", { class: "m-chart-tip-label" }, String(r.label)),
      h("span", { class: "m-chart-tip-value" }, String(r.value)))));
}

/** Legend: one toggle button per series (click or Enter/Space hides/shows it). */
export function Legend({ items, hidden, position, colors }: { items: () => readonly LegendItem[]; hidden: Signal<Set<string>>; position: () => string; colors: () => ChartBaseProps["colors"] }): Element {
  return h("div", { class: () => `m-chart-legend m-chart-legend-${position()}`, role: "group", "aria-label": "Legend", hidden: () => !items().length },
    each<LegendItem>({ each: items, key: (s) => s.key, children: (s) => h("button", {
      type: "button", class: () => `m-chart-legend-item ${seriesClass(s().index)}`,
      "class:m-chart-off": () => hidden().has(s().key), "aria-pressed": () => String(!hidden().has(s().key)),
      style: () => colorStyle(colors(), s().index), onClick: () => toggleIn(hidden, s().key),
    }, h("span", { class: "m-chart-swatch", "aria-hidden": "true" }), h("span", {}, () => String(s().label))) }));
}

/** Visually hidden table with the chart data (screen readers, copy/paste). */
export function DataTable<R>({ caption, columns, rows, limit = 1000 }: DataTableOptions<R>): Element {
  const shown = (): readonly R[] => { const r = rows(); return r.length > limit ? r.slice(0, limit) : r; };
  // a table ignores width:1px, so the hiding box is a wrapper (otherwise the table widens the page on phones)
  return h("div", { class: "m-sr-only" }, h("table", {},
    h("caption", {}, () => { const n = rows().length; return `${caption() ?? "Chart data"}${n > limit ? ` (first ${limit} of ${n} rows)` : ""}`; }),
    h("thead", {}, h("tr", {}, () => columns().map((c) => h("th", { scope: "col" }, String(c.label))))),
    h("tbody", {}, each<R>({ each: shown, children: (d, i) => h("tr", {}, () => columns().map((c, j) => h(j ? "td" : "th", j ? {} : { scope: "row" }, String(c.value(d(), i()) ?? "")))) }))));
}

/** Axis. `ticks()` → [{key, pos, label}]; `box()` → {x, y, w, h} plot area. */
export function Axis({ side, ticks, box, title }: { side: "bottom" | "left" | "right" | "top"; ticks: () => readonly Tick[]; box: () => Box; title?: () => unknown }): Element {
  const horiz = side === "bottom" || side === "top", far = side === "bottom" || side === "right", k = far ? 1 : -1;
  return h("g", { class: `m-chart-axis m-chart-axis-${horiz ? "x" : "y"} m-chart-axis-${side}`, "aria-hidden": "true",
    transform: attr(() => { const b = box(); return side === "bottom" ? `translate(${b.x},${b.y + b.h})` : side === "right" ? `translate(${b.x + b.w},${b.y})` : `translate(${b.x},${b.y})`; }) },
  h("line", { class: "m-chart-domain", x2: attr(() => (horiz ? box().w : 0)), y2: attr(() => (horiz ? 0 : box().h)) }),
  each<Tick>({ each: ticks, key: (t) => t.key, children: (t) => h("g", { class: "m-chart-tick", transform: attr(() => (horiz ? `translate(${t().pos},0)` : `translate(0,${t().pos})`)) },
    h("line", horiz ? { y2: 5 * k } : { x2: 5 * k }),
    h("text", horiz ? { y: far ? 18 : -9, "text-anchor": "middle" } : { x: 8 * k, dy: "0.32em", "text-anchor": far ? "start" : "end" }, attr(() => t().label))) }),
  // the axis title is drawn only while there is one (no empty text node for tests and screen readers to trip on)
  title ? () => { const t = title(); return t == null || t === "" ? null : h("text", { class: "m-chart-axis-title", "text-anchor": "middle",
    transform: attr(() => { const b = box(); return horiz ? `translate(${b.w / 2},${far ? 34 : -26})` : `translate(${far ? 40 : -40},${b.h / 2}) rotate(${far ? 90 : -90})`; }) }, String(t)); } : null);
}

/** Grid lines across the plot area for the given ticks (`dir` "h" = horizontal lines at y ticks). */
export function Grid({ dir, ticks, box }: { dir: "h" | "v"; ticks: () => readonly Tick[]; box: () => Box }): Element {
  const hz = dir === "h";
  return h("g", { class: "m-chart-grid", "aria-hidden": "true", transform: attr(() => `translate(${box().x},${box().y})`) },
    each<Tick>({ each: ticks, key: (t) => t.key, children: (t) => h("line", hz
      ? { x1: 0, x2: attr(() => box().w), y1: attr(() => t().pos), y2: attr(() => t().pos) }
      : { y1: 0, y2: attr(() => box().h), x1: attr(() => t().pos), x2: attr(() => t().pos) }) }));
}

/** Pick every k-th label so that at most `max` remain (category axes). */
export function thin<T>(ticks: readonly T[], max: number): readonly T[] {
  const k = Math.max(1, Math.ceil(ticks.length / Math.max(1, max)));
  return k === 1 ? ticks : ticks.filter((_, i) => i % k === 0);
}
