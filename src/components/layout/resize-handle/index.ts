// ResizeHandle (hadi-march/ui): the ready element of the resize-handle behavior — a thin strip on an edge (or a corner)
// of what it resizes, with one look everywhere: a line that lights up on hover, focus and while dragging. Give it
// `value` + `set` and it is a full separator (drag, arrows, Home / End, Enter resets, ARIA). Without them it is the
// bare grip for an owner that runs its own gesture (a window corner, a calendar event end): pointer events pass
// through the props, `onStep` gives it arrow keys.
import "./resize-handle.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { onCleanup, getOwner } from "../../../core/reactive.ts";
import { cx, val, rest, isRtl, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { resizeHandle, type ResizeHandleOptions } from "../../../behaviors/resize-handle/index.ts";

/** Where the handle sits on its (positioned) parent; "between": in the flow, between two flex items. */
export type ResizeEdge = "end" | "start" | "top" | "bottom" | "top-start" | "top-end" | "bottom-start" | "bottom-end" | "between";

/** Props of <ResizeHandle>. The behavior options (`value`, `set`, `min`, `max`, `step`, `scale`, `reset`…) are those of resizeHandle(). Other props go to the element. */
export interface ResizeHandleProps extends Partial<Omit<ResizeHandleOptions, "value">> {
  /** The current size: a number (a live JSX value) or an accessor. With `set` the handle is a full separator. */
  value?: number | (() => number) | undefined;
  /** Edge or corner of the parent (default "end"). start / top grow the thing toward the start (`invert`). */
  edge?: ResizeEdge | undefined;
  /** Accessible name (default "Resize"). */
  label?: MaybeFn<string | undefined>;
  /** The line: "hover" (default: on hover, focus and drag), "always", or "none". */
  line?: MaybeFn<"hover" | "always" | "none" | undefined>;
  /** A visible grip in the middle: true (a short bar), or your own node. */
  grip?: boolean | Node | undefined;
  /** Theme colour of the active line (default: the accent). */
  color?: ColorToken | undefined;
  /** No pointer, no focus. */
  disabled?: MaybeFn<boolean | undefined>;
  /** Without `value` + `set`: arrow keys call this with a step in px along x (RTL mirrored) and y; Shift = 4 steps. */
  onStep?: ((dx: number, dy: number, e: KeyboardEvent) => void) | undefined;
  /** Called with the element. */
  ref?: ((el: HTMLElement) => void) | undefined;
  class?: ClassProp | undefined;
  [attr: string]: unknown;
}

const USED = ["edge", "label", "line", "grip", "color", "disabled", "onStep", "ref", "value", "set", "min", "max", "step", "bigStep", "scale", "axis", "invert", "reset", "onStart", "onEnd"] as const;
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** `<ResizeHandle value={() => $w} set={(w) => $w = w} min={160} max={480} reset={() => $w = 240} label="Sidebar width" />` */
export function ResizeHandle(props: ResizeHandleProps): Element {
  const edge = props.edge ?? "end";
  const corner = edge.includes("-");
  const axis = corner ? null : props.axis ?? (edge === "top" || edge === "bottom" ? "block" : "inline");
  const full = !corner && props.value !== undefined && typeof props.set === "function";
  const value = (): number => { const v = props.value; return typeof v === "function" ? v() : v ?? 0; };
  const keys = full || props.onStep != null;
  const el = h("span", {
    "aria-hidden": keys ? null : "true",
    ...rest(props, USED),
    class: () => cx("m-resize-handle", `m-resize-handle-${edge}`, axis === "block" && "m-resize-handle-block", corner && "m-resize-handle-corner",
      `m-resize-handle-line-${val(props.line) ?? "hover"}`, val(props.disabled) && "is-disabled", val(props.class)),
    "data-m-color": colorAttr(props.color),
    "aria-label": keys ? () => val(props.label) ?? t`Resize` : null,
    tabindex: keys ? () => (val(props.disabled) ? "-1" : (props.tabindex as string | undefined) ?? "0") : (props.tabindex as string | undefined) ?? null,
  },
  props.grip ? h("span", { class: cx("m-resize-handle-grip", props.grip !== true && "is-own"), "aria-hidden": "true" }, props.grip === true ? null : props.grip) : null) as HTMLElement;

  if (full) {
    const stop = resizeHandle(el, {
      value, set: props.set!, min: props.min, max: props.max, step: props.step, bigStep: props.bigStep, scale: props.scale,
      axis: axis ?? "inline", invert: props.invert ?? (edge === "start" || edge === "top"), reset: props.reset, onStart: props.onStart, onEnd: props.onEnd,
    });
    if (getOwner()) onCleanup(stop);
  } else if (props.onStep) {
    // the owner's own gesture: arrows step it; an edge is still announced as a separator
    if (!corner) { el.setAttribute("role", "separator"); el.setAttribute("aria-orientation", axis === "block" ? "horizontal" : "vertical"); }
    else el.setAttribute("role", "button");
    el.addEventListener("keydown", (e: KeyboardEvent) => {
      const d = ARROWS[e.key];
      if (!d || (axis === "inline" && !d[0]) || (axis === "block" && !d[1])) return;
      e.preventDefault(); e.stopPropagation();
      const k = (props.step ?? 16) * (e.shiftKey ? 4 : 1);
      props.onStep!(d[0] * k * (isRtl(el) ? -1 : 1), d[1] * k, e);
    });
  }
  props.ref?.(el);
  return el;
}
