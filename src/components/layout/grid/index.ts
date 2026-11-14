// Grid (hadi-march/layout): responsive columns that never overflow; fill / balance the last row, equal rows. Pure CSS
// (grid.css is written by tools/gen-grid.js).
import "../../../ui/display.css";
import "./grid.css";
import { h } from "../../../dom/h.ts";
import { rest, val, cx, type ClassProp } from "../../../ui/util.ts";
import { clamp } from "../../../core/util.ts";

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
/** Responsive grid that never overflows: fixed or auto columns, fill and balance the last row, equal row heights. */
export function Grid(props: GridProps): Element {
  const cols = clamp(6, 1, props.cols ?? 2);
  // span mode: fixed columns that must fill the last row and/or keep all rows equal (pure CSS, see grid.css)
  const span = !props.min && !props.balance && (!!props.fill || !!props.equal) && props.cols != null;
  const flex = !span && (!!props.fill || !!props.balance);
  return h("div", { ...rest(props, ["cols", "gap", "min", "fill", "balance", "minCol", "equal"]),
    class: () => cx("m-grid", `m-grid-gap-${props.gap ?? 4}`,
      span ? ["m-grid-span", `m-gc-${cols}`, `m-gm-${minBucket(props.minCol)}`, props.fill && `m-grid-fill-${props.fill}`]
        : flex ? ["m-grid-flex", props.min ? "m-grid-flex-min" : `m-grid-c${cols}`, props.fill && `m-grid-fill-${props.fill}`, props.balance && "m-grid-balance"]
          : props.min ? "m-grid-auto" : `m-grid-${cols}`,
      props.equal && "m-grid-equal",
      val(props.class)),
    style: props.min || props.minCol ? { ...(props.min ? { "--m-grid-min": props.min } : {}), ...(props.minCol ? { "--m-grid-col-min": props.minCol } : {}) } : undefined }, props.children);
}
