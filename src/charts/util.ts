/// <reference path="../css.d.ts" />
// Shared helpers for chart components: reading props, accessors, formatting, series, sizing, ids.
import "./charts.css";
import { signal, computed, read, onCleanup, untrack, effect, type Accessor, type Signal } from "../core/reactive.ts";
import { animateValue } from "../motion/engine/value.ts";
import { reducedMotion } from "../motion/env.ts";
import { applyPipe, toDate } from "../core/pipes.ts";
import { h } from "../dom/h.ts";
import { For, type ForProps } from "../dom/for.ts";
import { uid } from "../core/util.ts";

/** A chart's `animate` prop: off, `true` (a spring) or an easing name. */
export type AnimateProp = boolean | string | null | undefined;
/**
 * The shape a mark is drawn with: the target at once, or (animate on) a tween of the numeric `keys` from what is drawn
 * now. `first` is where a new mark starts (default: its target, no entrance). Off with reduced motion.
 */
export function tween<T extends object>(target: () => T, keys: readonly (keyof T)[], how: () => AnimateProp, first?: (to: T) => T): () => T {
  const shown = signal(untrack(() => (first ? first(target()) : target())));
  let run: { cancel(): void } | null = null;
  effect(() => {
    const to = target(), mode = untrack(how), from = untrack(shown);
    run?.cancel(); run = null;
    if (!mode || reducedMotion() || keys.every((k) => from[k] === to[k])) return void shown.set(to);
    run = untrack(() => animateValue(0, 1, { easing: mode === true ? "spring" : mode, onUpdate: (t: number) => {
      const o = { ...to } as Record<keyof T, unknown>;
      for (const k of keys) o[k] = (from[k] as number) + ((to[k] as number) - (from[k] as number)) * t;
      shown.set(o as T);
    } }));
  });
  onCleanup(() => run?.cancel());
  return shown;
}

/** A prop that may be a plain value or a reactive accessor (signal, computed, compiler thunk). */
export type MaybeReactive<T> = T | (() => T);
/** Data prop: array (or any iterable), signal, getter or any function returning one. */
export type DataProp<D> = Iterable<D> | null | undefined | (() => Iterable<D> | null | undefined);
/** Reads one value of a row. */
export type Getter<D> = (d: D, i: number) => unknown;
/** Field spec: `"key"` (row property) or a getter. */
export type Field<D> = string | number | Getter<D>;
/** Series spec: a key or a getter (optionally carrying a `key` used for legend toggling and class names). */
export type SeriesSpec<D> = string | number | (Getter<D> & { key?: string });
/** Series labels: aligned with `y`, keyed by series key, or one label for a single series. */
export type SeriesLabels = readonly string[] | Readonly<Record<string, string>> | string;
/** Formatter spec: pipe name, `[pipe, ...args]` or a function. */
// a format function takes the value as the chart has it ((ms: number) => string): its parameter is any, so a typed one fits
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormatSpec = string | readonly [string, ...unknown[]] | ((v: any) => unknown);
export type Formatter = (v: unknown) => unknown;
/** Series as used by the charts. */
export interface Series<D> { key: string; label: string; get: Getter<D>; index: number }
/** Plot box in viewBox units. */
export interface Box { x: number; y: number; w: number; h: number }
/** Width/height signals of a chart. */
export interface Size { width: Accessor<number>; height: Accessor<number>; responsive: Accessor<boolean>; observe: (el: Element) => void }
/** Props shared by every framed chart. */
export interface ChartBaseProps {
  /** Accessible name: the SVG <title> and the table caption (default "Chart"). @tr Erişilebilir ad: SVG <title> ve tablo başlığı (varsayılan "Chart"). */
  title?: MaybeReactive<string | null | undefined> | undefined;
  /** Longer description, rendered as the SVG <desc>. @tr Daha uzun açıklama; SVG <desc> olarak yazılır. */
  description?: MaybeReactive<string | null | undefined> | undefined;
  /** Shown when there is no data (default "No data"). @tr Veri yokken gösterilir (varsayılan "No data"). */
  empty?: MaybeReactive<unknown> | undefined;
  /** `true`, `false`, "bottom" or "right"; shown by default when there is more than one series. Items toggle series. @tr `true`, `false`, "bottom" ya da "right"; varsayılan olarak birden çok seri varsa gösterilir. Öğeleri serileri açıp kapatır. */
  legend?: MaybeReactive<boolean | "right" | "bottom" | null | undefined> | undefined;
  /** Extra CSS class on the wrapper. @tr Sarmalayıcıya eklenen ek CSS sınıfı. */
  class?: MaybeReactive<string | null | undefined> | undefined;
  /** Per-series colors overriding the palette (set as `--m-c`). @tr Paleti geçersiz kılan seri başına renkler (`--m-c` olarak verilir). */
  colors?: MaybeReactive<readonly string[] | null | undefined> | undefined;
  /** Width in px; without it the chart fills its container and follows its size. @tr px cinsinden genişlik; verilmezse grafik kabını doldurur ve boyutunu izler. */
  width?: MaybeReactive<number | string | null | undefined> | undefined;
  /** Height in px (default 240; bar charts 260). @tr px cinsinden yükseklik (varsayılan 240; çubuk grafiklerde 260). */
  height?: MaybeReactive<number | string | null | undefined> | undefined;
}

/** One decimal place (SVG coordinates). */
export const f1 = (v: number): number => Math.round(v * 10) / 10;
export const nextId = (p = "m-chart"): string => uid(p);

/** Data prop: array, signal, getter or any function returning an array. */
export const rowsOf = <D>(v: DataProp<D>): D[] => {
  const r = typeof v === "function" ? v() : v;
  return Array.isArray(r) ? (r as D[]) : r == null ? [] : [...r];
};

/** `"key"` → d => d.key; function → itself; undefined → fallback. */
export function accessor<D>(spec: Field<D> | null | undefined, fallback: Getter<D> = (d) => d): Getter<D> {
  if (typeof spec === "function") return spec as Formatter;
  if (spec == null) return fallback;
  return (d) => (d as Record<string | number, unknown> | null | undefined)?.[spec];
}

/** Value formatter from a pipe name, `[pipe, ...args]` or a function. */
export function formatter(spec: FormatSpec | null | undefined, fallback: Formatter = (v) => applyPipe("number", v)): Formatter {
  if (typeof spec === "function") return spec;
  if (typeof spec === "string") return (v) => applyPipe(spec, v);
  if (Array.isArray(spec) && spec.length) { const [name, ...args] = spec as readonly [string, ...unknown[]]; return (v) => applyPipe(name, v, ...args); }
  return fallback;
}

/** Number or null (missing values become gaps). */
export const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

/** Series from `y` (key, keys or functions) and `series` (labels: array aligned with y, or { key: label }). */
export function seriesOf<D>(y: SeriesSpec<D> | readonly SeriesSpec<D>[] | null | undefined, labels: SeriesLabels | null | undefined): Series<D>[] {
  const list: readonly SeriesSpec<D>[] = Array.isArray(y) ? (y as readonly SeriesSpec<D>[]) : [(y as SeriesSpec<D> | null | undefined) ?? "y"];
  return list.map((spec, i) => {
    const key = typeof spec === "function" ? (spec.key ?? `s${i}`) : String(spec);
    const label = Array.isArray(labels) ? (labels as readonly string[])[i]
      : labels && typeof labels === "object" ? (labels as Readonly<Record<string, string>>)[key]
        : typeof labels === "string" && list.length === 1 ? labels : null;
    return { key, label: label ?? (typeof spec === "function" ? `Series ${i + 1}` : key), get: accessor(spec), index: i };
  });
}

/** Class for the n-th series color (`m-chart-series-0..7`). */
export const seriesClass = (i: number): string => `m-chart-series-${((i % 8) + 8) % 8}`;
/** Style object (CSSOM, CSP safe) for a `colors` override, or undefined. */
export const colorStyle = (colors: ChartBaseProps["colors"], i: number): { "--m-c": string } | undefined => {
  const c = read(colors)?.[i];
  return c ? { "--m-c": String(c) } : undefined;
};

export type XKind = "time" | "linear" | "band";
/** Detect the x scale kind: "time" (Date / ISO date strings), "linear" (numbers) or "band". */
export function xKind(values: readonly unknown[], forced?: XKind | null): XKind {
  if (forced) return forced;
  const v = values.find((x) => x != null);
  if (v instanceof Date || (v && typeof v === "object" && ("seconds" in v || "_seconds" in v))) return "time";
  if (typeof v === "number") return "linear";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return "time";
  return "band";
}
export const timeMs = (v: unknown): number => toDate(v)?.getTime() ?? NaN;

/** Default x tick format for a time span. */
export function timeFormat(spanMs: number): Formatter {
  if (spanMs < 864e5) return (v) => applyPipe("time", v);
  if (spanMs <= 400 * 864e5) return (v) => applyPipe("date", v, { month: "short", day: "numeric" });
  return (v) => applyPipe("date", v, { year: "numeric", month: "short" });
}

/** Default format for one time value (tooltip, data table). */
export const timeDetail = (spanMs: number): Formatter => (spanMs <= 2 * 864e5 ? (v) => applyPipe("datetime", v) : (v) => applyPipe("date", v));

/**
 * Width/height signals. Explicit `width` wins; otherwise the width follows the container (ResizeObserver when available).
 * `observe(el)` is used as the wrapper's `ref`.
 */
export function useSize(props: Pick<ChartBaseProps, "width" | "height">, dw = 640, dh = 240): Size {
  const measured = signal(0);
  const width = computed(() => num(read(props.width)) ?? (measured() || dw));
  const height = computed(() => num(read(props.height)) ?? dh);
  const responsive = computed(() => read(props.width) == null);
  const observe = (el: Element): void => {
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (!RO || !untrack(responsive)) return;
    const ro = new RO((entries) => { const w = Math.round(entries[0]?.contentRect?.width ?? 0); if (w > 0) measured.set(w); });
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  };
  return { width, height, responsive, observe };
}

/** A computed attribute value: the bound DOM attribute is written only when the value really changes. */
export const attr = <T>(fn: () => T): Accessor<T> => computed(fn);

/** Rough label width (px) for margins without measuring text. */
export const textWidth = (s: unknown, px = 6.5): number => String(s ?? "").length * px;

/** Toggle `key` in a Set signal (immutable update). */
export function toggleIn<K>(set: Signal<Set<K>>, key: K): void {
  const next = new Set(set.peek());
  next.has(key) ? next.delete(key) : next.add(key);
  set.set(next);
}

/** Pointer position inside the svg in viewBox units (no layout in tests: falls back to clientX/Y). */
export function localPoint(svg: Element | null, e: { clientX?: number; clientY?: number }, width: number): [number, number] {
  const r = svg?.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 0 };
  const k = r.width ? width / r.width : 1;
  return [((e.clientX ?? 0) - r.left) * k, ((e.clientY ?? 0) - r.top) * k];
}

/** Keyboard navigation between items `lo..hi`: arrows, Home/End, PageUp/PageDown. Returns the new index or null. */
export function navIndex(key: string, i: number, lo: number, hi: number): number | null {
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
export const sameBox = (a: Box | undefined, b: Box | undefined): boolean => !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/** Typed `h(For, …)`: keyed list whose row type is inferred from `children` (same as passing the render function as a child). */
export const each = <T>(props: ForProps<T>): unknown => h<ForProps<T>>(For, props);

/** Point passed to `tooltip(point)` and `onSelect(point)` of line, area and bar charts. */
export interface ChartPoint<D> { index: number; datum: D | undefined; x: unknown; label: unknown; values: Record<string, number | null>; series: string | null; y: number | null | undefined }
/** `tooltip` prop: false hides it, a function renders custom content for a point. */
export type TooltipProp<P> = MaybeReactive<boolean | ((p: P) => unknown) | null | undefined> | undefined;
