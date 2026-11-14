// Small charts: Sparkline, Stat (KPI box), ProgressRing (0–100 score) and BarList (ranked horizontal bars).
import { computed, read, reactive, effect } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { lttb } from "./lttb.ts";
import { svgIcon, isIconDef } from "../icons/svg.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, attr, each, type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, f1 } from "./util.ts";
import { OverflowText } from "../ui/marquee.ts";
import { StatTile } from "../components/data/stat-tile/index.ts";
import { colorAttr, colorList, paintOf, type ColorToken, type MultiColors } from "../theme/colors.ts";
import { cx } from "../ui/util.ts";
import { clamp } from "../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

export interface SparklineProps<D = unknown> {
  data?: DataProp<D>;
  y?: Field<D> | undefined;
  width?: Opt<number | string>;
  height?: Opt<number | string>;
  format?: Opt<FormatSpec>;
  zero?: Opt<boolean>;
  area?: Opt<boolean>;
  dot?: Opt<boolean>;
  color?: Opt<number>;
  colors?: ChartBaseProps["colors"];
  title?: Opt<string>;
  empty?: Opt<string>;
}
export interface StatProps<D = unknown> {
  label?: Opt<unknown>;
  value?: Opt<unknown>;
  previous?: Opt<number>;
  delta?: Opt<number>;
  format?: Opt<FormatSpec>;
  deltaFormat?: Opt<FormatSpec>;
  invert?: Opt<boolean>;
  hint?: Opt<unknown>;
  empty?: Opt<unknown>;
  class?: Opt<string>;
  spark?: DataProp<D>;
  sparkY?: Field<D> | undefined;
  /** An icon (hadi-march/icons) shown next to the label. */
  icon?: unknown;
}
export interface ProgressRingProps {
  /**
   * Several colors: "brand" (the four HADİ colors, the HADİ theme's default), a list of color tokens, or "single" (one
   * color even in a multicolor theme).
   */
  colors?: MultiColors | undefined;
  /** How several colors are laid out: "gradient" (default), "segments" (equal parts) or "cycle" (colors flow). */
  paint?: "gradient" | "segments" | "cycle" | undefined;
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  value?: Opt<number>;
  max?: Opt<number>;
  size?: Opt<number>;
  thickness?: Opt<number>;
  thresholds?: Opt<readonly [number, number]>;
  format?: Opt<FormatSpec>;
  label?: Opt<string>;
}
/** BarList row as passed to `onSelect`. */
export interface BarListItem<D = unknown> { key: string; label: string; value: number; datum: D; index: number }
export interface BarListProps<D = unknown> {
  data?: DataProp<D>;
  x?: Field<D> | undefined;
  y?: Field<D> | readonly Field<D>[] | undefined;
  format?: Opt<FormatSpec>;
  sort?: Opt<boolean>;
  limit?: Opt<number>;
  max?: Opt<number>;
  color?: Opt<number>;
  colors?: ChartBaseProps["colors"];
  title?: Opt<string>;
  empty?: Opt<unknown>;
  class?: Opt<string>;
  onSelect?: ((item: BarListItem<D> & { rank: number }) => void) | undefined;
}


/** Tiny trend line without axes. `data` = numbers or objects (`y` key/fn). */
export function Sparkline<D>(props: SparklineProps<D>): Element {
  const w = computed(() => num(read(props.width)) ?? 120), ht = computed(() => num(read(props.height)) ?? 32);
  const vals = computed(() => { const g = accessor(props.y); return rowsOf(props.data).map((d, i) => num(g(d, i))); });
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const geo = computed((): { line: string; area: string; last: [number, number] | null } => {
    const v = vals(), W = w(), H = ht(), pad = 3;
    const at = (i: number): number => v[i] as number;
    let idx = v.map((_, i) => i).filter((i) => v[i] != null);
    if (idx.length > W * 2) idx = lttb(idx, Math.round(W * 2), (i) => i, at);
    if (!idx.length) return { line: "", area: "", last: null };
    let lo = Infinity, hi = -Infinity;
    for (const i of idx) { lo = Math.min(lo, at(i)); hi = Math.max(hi, at(i)); }
    if (read(props.zero)) lo = Math.min(lo, 0);
    const n = v.length - 1 || 1, sx = (i: number): number => f1(pad + (i / n) * (W - pad * 2));
    const sy = (x: number): number => f1(hi === lo ? H / 2 : H - pad - ((x - lo) / (hi - lo)) * (H - pad * 2));
    const pts = idx.map((i) => `${sx(i)},${sy(at(i))}`);
    const last = idx[idx.length - 1] as number;
    return { line: `M${pts.join("L")}`, area: `M${sx(idx[0] as number)},${H}L${pts.join("L")}L${sx(last)},${H}Z`, last: [sx(last), sy(at(last))] };
  });
  const summary = (): unknown => {
    const v = vals().filter((x): x is number => x != null), f = fmt();
    if (!v.length) return read(props.empty) ?? "No data";
    return `${v.length} values, from ${f(v[0])} to ${f(v[v.length - 1])}, min ${f(Math.min(...v))}, max ${f(Math.max(...v))}`;
  };
  return h("svg", {
    class: () => `m-sparkline ${seriesClass(num(read(props.color)) ?? 0)}`, style: () => colorStyle(props.colors, 0),
    role: "img", "aria-label": () => (read(props.title) ? `${read(props.title)}: ${summary()}` : summary()),
    viewBox: () => `0 0 ${w()} ${ht()}`, width: w, height: ht, preserveAspectRatio: "none",
  },
  () => (read(props.area) ? h("path", { class: "m-chart-area", d: attr(() => geo().area) }) : null),
  h("path", { class: "m-chart-line", d: attr(() => geo().line) }),
  h("circle", { class: "m-chart-marker", r: 2.5, visibility: () => (geo().last && read(props.dot) !== false ? "visible" : "hidden"),
    cx: attr(() => geo().last?.[0] ?? 0), cy: attr(() => geo().last?.[1] ?? 0) }));
}

type Dir = "up" | "down" | "flat";
const ARROWS: Record<Dir, string> = { up: "↑", down: "↓", flat: "–" };
const SAY: Record<Dir, string> = { up: "Up ", down: "Down ", flat: "No change " };

/**
 * KPI box: label, formatted value, delta (fraction by default: 0.12 → "+12%") with an arrow, optional sparkline.
 * `previous` computes the delta; `invert` marks a decrease as good (e.g. costs); `deltaFormat` formats |delta|.
 */
export function Stat<D>(props: StatProps<D>): Element {
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const delta = computed(() => {
    const d = num(read(props.delta));
    if (d != null) return d;
    const v = num(read(props.value)), p = num(read(props.previous));
    return v != null && p ? (v - p) / Math.abs(p) : null;
  });
  const dir = computed((): Dir | null => { const d = delta(); return d == null ? null : d > 0 ? "up" : d < 0 ? "down" : "flat"; });
  const deltaText = (): string => {
    const d = delta() as number, f = formatter(read<FormatSpec | null | undefined>(props.deltaFormat), (v) => formatter(["percent", 1])(v));
    return `${d > 0 ? "+" : d < 0 ? "−" : ""}${f(Math.abs(d))}`;
  };
  const hasSpark = computed(() => !!read(props.spark as MaybeReactive<unknown>));
  const tone = (): string => { const d = dir(); if (!d || d === "flat") return "m-stat-neutral"; return (d === "up") !== !!read(props.invert) ? "m-stat-good" : "m-stat-bad"; };
  return h("div", { class: () => ["m-stat", read(props.class)].filter(Boolean).join(" ") },
    // label over value: the StatTile of hadi-march/data (one drawing of the tile); the delta pill and the sparkline are the chart's own
    h(StatTile, {
      align: "start", order: "label", partClass: { label: "m-stat-label", value: "m-stat-value" },
      label: [isIconDef(props.icon) ? h("span", { class: "m-stat-icon", "aria-hidden": "true" }, svgIcon(props.icon)) : null, h("span", {}, () => read(props.label) ?? "")],
      value: () => { const v = read(props.value); return v == null ? (read(props.empty) ?? "—") : fmt()(v); },
    }),
    () => (dir() ? h("div", { class: () => `m-stat-delta m-stat-${dir()} ${tone()}` },
      h("span", { class: "m-stat-arrow", "aria-hidden": "true" }, () => ARROWS[dir() as Dir]),
      h("span", { class: "m-sr-only" }, () => SAY[dir() as Dir]),
      h("span", { class: "m-stat-delta-value" }, deltaText),
      () => (read(props.hint) ? h("span", { class: "m-stat-hint" }, ` ${read(props.hint)}`) : null)) : null),
    () => (hasSpark() ? h(Sparkline, { data: reactive(() => read(props.spark as MaybeReactive<Iterable<D> | null | undefined>)), y: props.sparkY, width: 240, height: 40, area: true, title: reactive(() => read(props.label) as string | null | undefined) }) : null));
}

/** Score ring 0–100 (or 0–`max`). Level class `m-ring-low|mid|high` from `thresholds` (default [50, 80]). */
export function ProgressRing(props: ProgressRingProps): Element {
  const S = computed(() => num(read(props.size)) ?? 64), T = computed(() => num(read(props.thickness)) ?? 8);
  const max = computed(() => num(read(props.max)) ?? 100);
  const v = computed(() => clamp(num(read(props.value)) ?? 0, 0, max()));
  const r = computed(() => (S() - T()) / 2), C = computed(() => 2 * Math.PI * r());
  const level = computed(() => { const [a, b] = read(props.thresholds) ?? [50, 80], p = (v() / max()) * 100; return p < a ? "low" : p < b ? "mid" : "high"; });
  const text = (): unknown => formatter(read<FormatSpec | null | undefined>(props.format), (x) => String(Math.round(x as number)))(v());
  const list = colorList(props.colors);
  const svg = h("svg", { "data-m-color": () => colorAttr(props.color),
    class: () => `m-ring m-ring-${level()}`, role: "img", viewBox: () => `0 0 ${S()} ${S()}`, width: S, height: S,
    "aria-label": () => `${read(props.label) ?? "Score"}: ${text()} of ${max()}`,
  },
  h("circle", { class: "m-ring-track", cx: () => S() / 2, cy: () => S() / 2, r, "stroke-width": T }),
  h("circle", { class: "m-ring-value", cx: () => S() / 2, cy: () => S() / 2, r, "stroke-width": T, transform: () => `rotate(-90 ${S() / 2} ${S() / 2})`,
    "stroke-dasharray": attr(() => `${f1((C() * v()) / max())} ${f1(C())}`) }),
  h("text", { class: "m-ring-text", x: () => S() / 2, y: () => S() / 2, "text-anchor": "middle", "dominant-baseline": "central", "aria-hidden": "true" }, text));
  if (!list && props.paint !== "cycle") return svg as Element;
  // several colors: SVG strokes cannot take a sweep gradient, so a conic paint is masked to the ring (CSS) and laid over
  const paint = h("span", { class: cx("m-ring-paint", props.paint === "cycle" && "is-cycle"), "aria-hidden": "true" }) as HTMLElement;
  const wrap = h("span", { class: "m-ring-multi", "data-m-color": () => colorAttr(props.color), "data-m-colors": list ? (Array.isArray(props.colors) ? "custom" : String(props.colors)) : null }, svg, paint) as HTMLElement;
  paint.style.setProperty("--m-ring-paint", paintOf(list ?? ["cat-1", "cat-2", "cat-3", "cat-4"], props.paint === "segments" ? "segments" : "gradient", "conic", true));
  effect(() => { wrap.style.setProperty("--m-ring-s", `${S()}px`); wrap.style.setProperty("--m-ring-t", `${T()}px`); wrap.style.setProperty("--m-ring-p", String(props.paint === "cycle" ? 1 : v() / max())); });
  return wrap
}

/** Ranked horizontal bars with labels ("top N" lists). Rows are buttons when `onSelect` is set. */
export function BarList<D>(props: BarListProps<D>): Element {
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const items = computed(() => {
    const l = accessor(props.x ?? "label"), y = accessor(Array.isArray(props.y) ? (props.y as readonly Field<D>[])[0] : (props.y as Field<D> | undefined) ?? "value");
    let list: BarListItem<D>[] = rowsOf(props.data).map((d, i) => ({ key: String(l(d, i)), label: String(l(d, i)), value: num(y(d, i)) ?? 0, datum: d, index: i }));
    if (read(props.sort) !== false) list = list.slice().sort((a, b) => b.value - a.value);
    const n = num(read(props.limit));
    return n ? list.slice(0, n) : list;
  });
  const max = computed(() => num(read(props.max)) ?? Math.max(0, ...items().map((i) => i.value)));
  return h("div", { class: () => ["m-barlist", read(props.class)].filter(Boolean).join(" "), role: "list", "aria-label": () => read(props.title) ?? null },
    each<BarListItem<D>>({ each: items, key: (i) => i.key, fallback: () => h("div", { class: "m-chart-empty" }, read(props.empty) ?? "No data"), children: (it, idx) => {
      const pct = attr(() => `${max() > 0 ? f1((Math.max(0, it().value) / max()) * 100) : 0}%`);
      const sel = props.onSelect;
      return h("div", { role: "listitem", class: "m-barlist-item" },
        h(sel ? "button" : "div", { class: "m-barlist-row", ...(sel ? { type: "button", onClick: () => sel({ ...it(), rank: idx() + 1 }) } : {}) },
          h("svg", { class: "m-barlist-bar", "aria-hidden": "true", width: "100%", height: "100%", preserveAspectRatio: "none" },
            h("rect", { class: () => `m-barlist-fill ${seriesClass(num(read(props.color)) ?? 0)}`, style: () => colorStyle(props.colors, 0), x: 0, y: 0, height: "100%", width: pct })),
          h(OverflowText, { class: "m-barlist-label" }, () => it().label),
          h("span", { class: "m-barlist-value" }, () => fmt()(it().value))));
    } }));
}
