// Shared helpers for chart components: reading props, accessors, formatting, series, sizing, ids.
import { signal, computed, read, onCleanup, untrack } from "../core/reactive.js";
import { applyPipe, toDate } from "../core/pipes.js";

let uid = 0;
export const nextId = (p = "hm-chart") => `${p}-${++uid}`;

/** Data prop: array, signal, getter or any function returning an array. */
export const rowsOf = (v) => { const r = typeof v === "function" ? v() : v; return Array.isArray(r) ? r : r == null ? [] : [...r]; };

/** `"key"` → d => d.key; function → itself; undefined → fallback. */
export function accessor(spec, fallback = (d) => d) {
  if (typeof spec === "function") return spec;
  if (spec == null) return fallback;
  return (d) => d?.[spec];
}

/** Value formatter from a pipe name, `[pipe, ...args]` or a function. */
export function formatter(spec, fallback = (v) => applyPipe("number", v)) {
  if (typeof spec === "function") return spec;
  if (typeof spec === "string") return (v) => applyPipe(spec, v);
  if (Array.isArray(spec) && spec.length) { const [name, ...args] = spec; return (v) => applyPipe(name, v, ...args); }
  return fallback;
}

/** Number or null (missing values become gaps). */
export const num = (v) => (v == null || v === "" || isNaN(v = Number(v)) ? null : v);

/**
 * Series from `y` (key, keys or functions) and `series` (labels: array aligned with y, or { key: label }).
 * @returns {{key: string, label: string, get: Function, index: number}[]}
 */
export function seriesOf(y, labels) {
  const list = Array.isArray(y) ? y : [y ?? "y"];
  return list.map((spec, i) => {
    const key = typeof spec === "function" ? (spec.key ?? `s${i}`) : String(spec);
    const label = Array.isArray(labels) ? labels[i] : labels && typeof labels === "object" ? labels[key] : typeof labels === "string" && list.length === 1 ? labels : null;
    return { key, label: label ?? (typeof spec === "function" ? `Series ${i + 1}` : key), get: accessor(spec), index: i };
  });
}

/** Class for the n-th series color (`hm-chart-series-0..7`). */
export const seriesClass = (i) => `hm-chart-series-${((i % 8) + 8) % 8}`;
/** Style object (CSSOM, CSP safe) for a `colors` override, or undefined. */
export const colorStyle = (colors, i) => { const c = read(colors)?.[i]; return c ? { "--hm-c": String(c) } : undefined; };

/** Detect the x scale kind: "time" (Date / ISO date strings), "linear" (numbers) or "band". */
export function xKind(values, forced) {
  if (forced) return forced;
  const v = values.find((x) => x != null);
  if (v instanceof Date || (v && typeof v === "object" && ("seconds" in v || "_seconds" in v))) return "time";
  if (typeof v === "number") return "linear";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return "time";
  return "band";
}
export const timeMs = (v) => toDate(v)?.getTime() ?? NaN;

/** Default x tick format for a time span. */
export function timeFormat(spanMs) {
  if (spanMs < 864e5) return (v) => applyPipe("time", v);
  if (spanMs <= 400 * 864e5) return (v) => applyPipe("date", v, { month: "short", day: "numeric" });
  return (v) => applyPipe("date", v, { year: "numeric", month: "short" });
}

/** Default format for one time value (tooltip, data table). */
export const timeDetail = (spanMs) => (spanMs <= 2 * 864e5 ? (v) => applyPipe("datetime", v) : (v) => applyPipe("date", v));

/**
 * Width/height signals. Explicit `width` wins; otherwise the width follows the container (ResizeObserver when available).
 * `observe(el)` is used as the wrapper's `ref`.
 */
export function useSize(props, dw = 640, dh = 240) {
  const measured = signal(0);
  const width = computed(() => num(read(props.width)) ?? (measured() || dw));
  const height = computed(() => num(read(props.height)) ?? dh);
  const responsive = computed(() => read(props.width) == null);
  const observe = (el) => {
    const RO = globalThis.ResizeObserver;
    if (!RO || !untrack(responsive)) return;
    const ro = new RO((entries) => { const w = Math.round(entries[0]?.contentRect?.width ?? 0); if (w > 0) measured.set(w); });
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  };
  return { width, height, responsive, observe };
}

/** A computed attribute value: the bound DOM attribute is written only when the value really changes. */
export const attr = (fn) => computed(fn);

/** Rough label width (px) for margins without measuring text. */
export const textWidth = (s, px = 6.5) => String(s ?? "").length * px;

/** Toggle `key` in a Set signal (immutable update). */
export function toggleIn(set, key) {
  const next = new Set(set.peek());
  next.has(key) ? next.delete(key) : next.add(key);
  set.set(next);
}

/** Pointer position inside the svg in viewBox units (no layout in tests: falls back to clientX/Y). */
export function localPoint(svg, e, width) {
  const r = svg?.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 0 };
  const k = r.width ? width / r.width : 1;
  return [((e.clientX ?? 0) - r.left) * k, ((e.clientY ?? 0) - r.top) * k];
}

/** Keyboard navigation between items `lo..hi`: arrows, Home/End, PageUp/PageDown. Returns the new index or null. */
export function navIndex(key, i, lo, hi) {
  const page = Math.max(1, Math.round((hi - lo) / 10));
  switch (key) {
    case "ArrowRight": case "ArrowDown": return i < lo ? lo : Math.min(hi, i + 1);
    case "ArrowLeft": case "ArrowUp": return i < lo ? hi : Math.max(lo, i - 1);
    case "Home": return lo;
    case "End": return hi;
    case "PageDown": return Math.min(hi, Math.max(lo, i) + page);
    case "PageUp": return Math.max(lo, Math.max(lo, i) - page);
    default: return null;
  }
}

/** Same plot box? (computed equality so geometry only recomputes on real size changes). */
export const sameBox = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
