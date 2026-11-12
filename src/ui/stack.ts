// Layout primitives: Stack, Grid, Toolbar, Divider. (hadi-march/ui; split from display.ts so each component is its own module and chunk).
import "./display.css";
import "./grid.css";
import { h } from "../dom/h.ts";
import { rest, val, cx, type MaybeFn, type ClassProp } from "./util.ts";

export type Align = "start" | "center" | "end" | "stretch" | "baseline" | "between";
const ALIGN: Record<string, string | undefined> = { start: "start", center: "center", end: "end", stretch: "stretch", baseline: "baseline", between: "between" };
export interface StackProps {
  /** Token step 0–8 (default 3). */
  gap?: number;
  direction?: "row" | "column";
  align?: Align;
  justify?: Align;
  wrap?: boolean;
  as?: string;
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}
/** `<Stack gap={3} direction="row" align="center" justify="between" wrap>…</Stack>` (gap = token step 0–8) */
export function Stack(props: StackProps): Element {
  return h(props.as ?? "div", { ...rest(props, ["gap", "direction", "align", "justify", "wrap", "as"]),
    class: () => cx("hm-stack", props.direction === "row" && "hm-stack-row", `hm-gap-${props.gap ?? 3}`, props.wrap && "hm-stack-wrap",
      ALIGN[props.align ?? ""] && `hm-align-${props.align}`, ALIGN[props.justify ?? ""] && `hm-justify-${props.justify}`, val(props.class)) }, props.children);
}
export interface GridProps {
  /** Columns 1–6 (default 2); collapses to 2 on tablets (4+ columns) and 1 on phones. */
  cols?: number;
  gap?: number;
  /** Auto columns of at least this width ("16rem") instead of a fixed count. */
  min?: string;
  /**
   * Last row: "stretch" — its items share the row's remaining space equally; "last" — only the last item grows into it
   * (with `cols`). Default: aligned columns with a gap at the end.
   */
  fill?: "stretch" | "last";
  /** Pick the column count that spreads items evenly over the rows (5 in 4 columns → 3 + 2, not 4 + 1). CSS only. */
  balance?: boolean;
  /** Narrowest column (default "9rem"): when the box is too narrow for `cols` of this width, fewer columns are used. */
  minCol?: string;
  /**
   * Every row as tall as the tallest, across the whole grid. With `cols` it combines with `fill` (span mode: the last
   * row is filled AND all rows are equal). Cards in one row are always equal height.
   */
  equal?: boolean;
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}
/**
 * `<Grid cols={3} gap={4}>`, `<Grid min="16rem">` (auto columns), `<Grid cols={4} fill="stretch" balance>`,
 * `<Grid cols={4} minCol="17rem" fill="stretch" equal>` (last row filled, every row equally tall).
 * Pure CSS (grid / flex-wrap, :has() for balance); items never overflow horizontally.
 */
// span mode buckets: the generated container queries exist for these minimum column widths (tools/gen-grid.js)
const MIN_COLS = [9, 13, 17];
const minBucket = (v: string | undefined): number => {
  const rem = !v ? 9 : v.endsWith("px") ? parseFloat(v) / 16 : parseFloat(v);
  return MIN_COLS.reduce((a, b) => (Math.abs(b - rem) < Math.abs(a - rem) ? b : a), 9);
};
export function Grid(props: GridProps): Element {
  const cols = Math.max(1, Math.min(props.cols ?? 2, 6));
  // span mode: fixed columns that must fill the last row and/or keep all rows equal (pure CSS, see grid.css)
  const span = !props.min && !props.balance && (!!props.fill || !!props.equal) && props.cols != null;
  const flex = !span && (!!props.fill || !!props.balance);
  return h("div", { ...rest(props, ["cols", "gap", "min", "fill", "balance", "minCol", "equal"]),
    class: () => cx("hm-grid", `hm-grid-gap-${props.gap ?? 4}`,
      span ? ["hm-grid-span", `hm-gc-${cols}`, `hm-gm-${minBucket(props.minCol)}`, props.fill && `hm-grid-fill-${props.fill}`]
        : flex ? ["hm-grid-flex", props.min ? "hm-grid-flex-min" : `hm-grid-c${cols}`, props.fill && `hm-grid-fill-${props.fill}`, props.balance && "hm-grid-balance"]
          : props.min ? "hm-grid-auto" : `hm-grid-${cols}`,
      props.equal && "hm-grid-equal",
      val(props.class)),
    style: props.min || props.minCol ? { ...(props.min ? { "--hm-grid-min": props.min } : {}), ...(props.minCol ? { "--hm-grid-col-min": props.minCol } : {}) } : undefined }, props.children);
}
export interface ToolbarProps { label?: MaybeFn<string>; end?: unknown; class?: ClassProp; children?: unknown }
/** Horizontal bar of controls: `<Toolbar label="Filters" end={<Button>…</Button>}>…</Toolbar>` */
export function Toolbar(props: ToolbarProps): Element {
  return h("div", { class: () => cx("hm-toolbar", val(props.class)), role: "toolbar", "aria-label": () => val(props.label) ?? null },
    h("div", { class: "hm-toolbar-start" }, props.children),
    props.end != null && h("div", { class: "hm-toolbar-end" }, props.end));
}
export interface DividerProps { label?: MaybeFn<string>; vertical?: boolean }
/** `<Divider />` or `<Divider label="or" />`; `vertical` for inline separators. */
export function Divider(props: DividerProps = {}): Element {
  if (props.label != null) return h("div", { class: "hm-divider hm-divider-label", role: "separator" }, h("span", {}, () => val(props.label)));
  return h(props.vertical ? "span" : "hr", { class: cx("hm-divider", props.vertical && "hm-divider-v"), role: props.vertical ? "separator" : null, "aria-orientation": props.vertical ? "vertical" : null });
}

// ------------------------------------------------------------------ loaders
