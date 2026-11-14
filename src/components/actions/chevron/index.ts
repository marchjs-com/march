// Chevron (hadi-march/actions): the small arrow that turns when something opens (accordion, disclosure, tree row,
// grouped table row, select). It points to `direction` while closed and turns when `open`: end → down, start → down,
// down → up, up → down; right-to-left pages mirror end / start. Without `open` it follows the nearest ancestor that
// carries the state (`aria-expanded`, or the `<summary>` of an open `<details>`), so a trigger button needs no wiring.
// Decoration only: the trigger says the state (aria-expanded); the arrow is hidden from assistive technology.
import "./chevron.css";
import { h } from "../../../dom/h.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";

/** Where a Chevron points while closed. */
export type ChevronDirection = "end" | "start" | "down" | "up";

export interface ChevronProps {
  /** Open state. Omit it and the arrow follows the nearest `aria-expanded` ancestor (or an open `<details>` summary). */
  open?: MaybeFn<boolean | undefined>;
  /** Where it points while closed: "end" (default; turns down), "start" (turns down), "down" (turns up), "up" (turns down). */
  direction?: MaybeFn<ChevronDirection | undefined>;
  /** xs · sm (default) · md · lg. */
  size?: MaybeFn<"xs" | "sm" | "md" | "lg" | undefined>;
  /** The turn: "smooth" (default), "spring", or `false` (jumps). */
  motion?: MaybeFn<"smooth" | "spring" | false | undefined>;
  /** Own icon drawn pointing to the inline end (an icon of hadi-march/icons, text or a node); it turns the same way. */
  icon?: unknown;
  /** Theme colour token; default: the text colour around it. */
  color?: MaybeFn<ColorToken | undefined>;
  /** Keeps the box but draws nothing (a tree leaf lines up with its siblings). */
  leaf?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
  /** Other attributes (`data-*`, `id`) go to the arrow. */
  [attr: string]: unknown;
}

/** `<Chevron open={$open} />`, `<button aria-expanded={$open}>Details <Chevron direction="down" /></button>` (follows the button). */
export function Chevron(props: ChevronProps): Element {
  const state = (): string => { const o = val(props.open); return o == null ? "is-auto" : o ? "is-open" : "is-closed"; };
  const motion = (): string | false => { const m = val(props.motion); return m === false ? "is-still" : m === "spring" && "is-spring"; };
  return h("span", {
    ...rest(props, ["open", "direction", "size", "motion", "icon", "color", "leaf"]),
    class: () => cx("m-chevron", `m-chevron-${val(props.direction) ?? "end"}`, `m-chevron-${val(props.size) ?? "sm"}`, state(), motion(), val(props.leaf) && "is-leaf", val(props.class)),
    "data-m-color": () => colorAttr(val(props.color)), "aria-hidden": "true",
  }, () => (val(props.leaf) ? null : ownIcon(props.icon, chevronRight, "m-chevron-own")));
}
