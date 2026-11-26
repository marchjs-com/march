// Range navigator: a small overview of the whole series under a chart with a window you drag (move it, or pull an
// edge) to pick the shown range. The range is fractions [0..1] of the overview; the chart maps it to its x domain.
import { signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { clamp } from "../core/util.ts";
import { attr, localPoint, f1, each } from "./util.ts";

/** One series drawn in the overview. */
export interface NavPath { key: string; line: string; area: string; cls: string; style?: Record<string, string> | undefined }
export interface NavigatorOptions {
  /** Width of the chart (viewBox units) and the left / right edge of its plot. */
  width: () => number; x: () => number; w: () => number;
  /** Navigator height (default 48). */
  height: () => number;
  /** The shown range as fractions, or null (everything). */
  range: () => readonly [number, number] | null;
  onRange: (r: readonly [number, number] | null) => void;
  /** Overview paths, drawn in [0..w] × [0..height] (one per series). */
  paths: () => readonly NavPath[];
  /** Accessible names of the two edges (default "Range start" / "Range end"). */
  labels?: () => readonly [unknown, unknown] | null | undefined;
  /** Text for a fraction (the slider's value text). */
  valueText: (f: number) => string;
}

const MIN = 0.02;
/** The navigator strip (its own svg under the chart). */
export function Navigator(o: NavigatorOptions): Element {
  let svg: Element | null = null;
  const drag = signal<{ mode: "move" | "a" | "b" | "new"; at: number; r: readonly [number, number] } | null>(null);
  const r = (): readonly [number, number] => o.range() ?? [0, 1];
  const fx = (e: PointerEvent): number => clamp((localPoint(svg, e, o.width())[0] - o.x()) / (o.w() || 1), 0, 1);
  const set = (a: number, b: number): void => { const lo = clamp(Math.min(a, b), 0, 1), hi = clamp(Math.max(a, b), 0, 1); o.onRange(lo <= 0.0005 && hi >= 0.9995 ? null : [lo, Math.max(hi, lo + MIN)]); };
  const down = (mode: "move" | "a" | "b" | "new") => (e: PointerEvent): void => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const at = fx(e);
    drag.set({ mode, at, r: mode === "new" ? [at, at] : r() });
  };
  const move = (e: PointerEvent): void => {
    const d = drag.peek();
    if (!d) return;
    const p = fx(e), dx = p - d.at, [a, b] = d.r;
    if (d.mode === "move") { const w = b - a, na = clamp(a + dx, 0, 1 - w); set(na, na + w); }
    else if (d.mode === "a") set(Math.min(a + dx, b - MIN), b);
    else if (d.mode === "b") set(a, Math.max(b + dx, a + MIN));
    else if (Math.abs(dx) > 0.005) set(d.at, p);
  };
  const up = (): void => { drag.set(null); };
  const key = (edge: "a" | "b") => (e: KeyboardEvent): void => {
    const [a, b] = r(), step = e.shiftKey ? 0.1 : 0.02;
    const d = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : e.key === "ArrowRight" || e.key === "ArrowUp" ? step : 0;
    if (e.key === "Home") { e.preventDefault(); return edge === "a" ? set(0, b) : set(a, a + MIN); }
    if (e.key === "End") { e.preventDefault(); return edge === "a" ? set(b - MIN, b) : set(a, 1); }
    if (e.key === "Escape") return o.onRange(null);
    if (!d) return;
    e.preventDefault();
    edge === "a" ? set(Math.min(a + d, b - MIN), b) : set(a, Math.max(b + d, a + MIN));
  };
  const X = (f: number): number => f1(f * o.w());
  const label = (i: 0 | 1): string => String(o.labels?.()?.[i] ?? (i ? t`Range end` : t`Range start`));
  const handle = (i: 0 | 1): Element => h("rect", {
    class: "m-chart-nav-handle", role: "slider", tabindex: 0, "aria-label": () => label(i), "aria-orientation": "horizontal",
    "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": attr(() => Math.round(r()[i] * 100)), "aria-valuetext": attr(() => o.valueText(r()[i])),
    x: attr(() => X(r()[i]) - 4), y: attr(() => o.height() / 2 - 10), width: 8, height: 20, rx: 3,
    onPointerDown: down(i ? "b" : "a"), onKeyDown: key(i ? "b" : "a"),
  });
  return h("svg", {
    class: "m-chart-nav", viewBox: () => `0 0 ${o.width()} ${o.height()}`, preserveAspectRatio: "xMinYMin meet", role: "group", "aria-label": () => t`Range navigator`,
    ref: (el: Element) => { svg = el; }, onPointerMove: move, onPointerUp: up, onPointerCancel: up, onDblClick: () => o.onRange(null),
  },
  h("g", { transform: attr(() => `translate(${o.x()},0)`) },
    h("rect", { class: "m-chart-overlay", x: 0, y: 0, width: attr(o.w), height: attr(o.height), onPointerDown: down("new") }),
    each<NavPath>({ each: o.paths, key: (p) => p.key, children: (p) => h("g", { class: () => p().cls, style: () => p().style, "pointer-events": "none" },
      h("path", { class: "m-chart-area", d: attr(() => p().area) }), h("path", { class: "m-chart-line", d: attr(() => p().line) })) }),
    h("rect", { class: "m-chart-nav-shade", "pointer-events": "none", x: 0, y: 0, height: attr(o.height), width: attr(() => X(r()[0])) }),
    h("rect", { class: "m-chart-nav-shade", "pointer-events": "none", y: 0, height: attr(o.height), x: attr(() => X(r()[1])), width: attr(() => Math.max(0, o.w() - X(r()[1]))) }),
    h("rect", { class: "m-chart-nav-window", y: 0.5, height: attr(() => o.height() - 1), x: attr(() => X(r()[0])), width: attr(() => Math.max(1, X(r()[1]) - X(r()[0]))), onPointerDown: down("move") }),
    handle(0), handle(1)));
}

