// CornerMark (hadi-march/media): a small round mark in a corner of a picture, a card or an avatar: the "video" sign
// on a tile, the arrow that appears on a project cover, the "+" on a story ring. The parent must be positioned
// (`position: relative`). Corner, icon, colour, size and look are yours; decorative unless it has a `label`.
import "./corner-mark.css";
import { h } from "../../../dom/h.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

import type { Corner } from "../../layout/bottom-right-controls/index.ts";
// one definition of the corner names (shared with the corner controls), re-exported under the same name
export type { Corner } from "../../layout/bottom-right-controls/index.ts";
export interface CornerMarkProps {
  /** Which corner (logical: "end" is the right side in left-to-right text). Default "top-end". */
  corner?: MaybeFn<Corner | undefined>;
  /** The icon (an icon, text or a node); children work too. */
  icon?: unknown;
  /** Theme colour token: fills the mark ("solid") or colours the icon (other looks). */
  color?: MaybeFn<ColorToken | undefined>;
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** "scrim" (default: dark glass, for photos), "surface" (card colour with a shadow) or "solid" (filled with the colour). */
  variant?: MaybeFn<"scrim" | "surface" | "solid" | undefined>;
  /** A ring in the surface colour around the mark (cuts it out of an avatar). */
  ring?: MaybeFn<boolean | undefined>;
  /** "always" (default) or "hover": shown while an ancestor with class `m-corner-host` is hovered or has focus inside. */
  show?: MaybeFn<"always" | "hover" | undefined>;
  /** Sits half outside the corner (a badge on an avatar) instead of inside it. */
  overlap?: MaybeFn<boolean | undefined>;
  /** Accessible name; without it the mark is decorative. */
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
  children?: unknown;
}

/** `<CornerMark icon={video} />`, `<CornerMark corner="bottom-end" icon={plus} variant="solid" color="brand-orange" ring overlap />` */
export function CornerMark(props: CornerMarkProps): Element {
  const own = props.icon != null ? icon(props.icon, "m-corner-mark-icon") : props.children;
  return h("span", {
    class: () => cx("m-corner-mark", `m-corner-mark-${val(props.corner) ?? "top-end"}`, `m-corner-mark-${val(props.size) ?? "md"}`, `m-corner-mark-${val(props.variant) ?? "scrim"}`,
      val(props.ring) && "is-ringed", val(props.overlap) && "is-overlap", val(props.show) === "hover" && "is-hover", val(props.class)),
    "data-m-color": () => colorAttr(val(props.color)),
    role: () => (val(props.label) ? "img" : null), "aria-label": () => val(props.label) ?? null, "aria-hidden": () => (val(props.label) ? null : "true"),
  }, own);
}
