// IconTile (hadi-march/data): an icon in a tinted, rounded square (cards, list rows, empty states, flow nodes). The
// tint is a named tone or any theme colour token; soft, outline or solid; square or round; decorative unless it has a
// `label`. Children replace the icon.
import "./icon-tile.css";
import { h } from "../../../dom/h.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export type IconTone = "primary" | "neutral" | "success" | "warn" | "danger" | "info" | "violet" | "pink" | "teal";
export interface IconTileProps {
  icon?: unknown;
  tone?: MaybeFn<IconTone | undefined>;
  /** A theme colour token instead of a tone (`color="brand-orange"`, `cat-3`…). */
  color?: MaybeFn<ColorToken | undefined>;
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** "soft" (default: tinted ground), "outline" (framed, plain ground) or "solid" (filled). */
  variant?: MaybeFn<"soft" | "outline" | "solid" | undefined>;
  /** "square" (default, rounded) or "round". */
  shape?: MaybeFn<"square" | "round" | undefined>;
  /** Accessible name; without it the tile is decorative. */
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
  /** Own content instead of the icon. */
  children?: unknown;
}
/** An icon in a tinted rounded square: `<IconTile icon={users} tone="primary" />` */
export function IconTile(props: IconTileProps): Element {
  const variant = (): string => val(props.variant) ?? "soft";
  return h("span", {
    class: () => cx("hm-icon-tile", `hm-tile-${val(props.tone) ?? "primary"}`, `hm-icon-tile-${val(props.size) ?? "md"}`, variant() !== "soft" && `hm-icon-tile-${variant()}`, val(props.shape) === "round" && "hm-icon-tile-round", val(props.class)),
    "data-hm-color": () => colorAttr(val(props.color)),
    role: () => (val(props.label) ? "img" : null), "aria-label": () => val(props.label) ?? null, "aria-hidden": () => (val(props.label) ? null : "true"),
  }, props.icon != null ? icon(props.icon, "hm-icon") : props.children);
}
