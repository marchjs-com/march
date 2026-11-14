// SectionLabel (hadi-march/ui): the small heading of a group inside a panel — a menu, a palette, a sidebar, a property
// grid, an editor side panel. Small, uppercase, faint; an icon before it, a count after it and an actions slot at the
// end. One look for every such label.
import "./section-label.css";
import { h } from "../../../dom/h.ts";
import { cx, val, rest, icon, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

/** Props of <SectionLabel>. Unknown props (`id`, `role`, `aria-*`, events) go to the root element. */
export interface SectionLabelProps {
  /** The text (or pass children). */
  label?: MaybeFn<unknown> | undefined;
  /** Root element (default "div"): a heading level, "p", "legend", "li", "span". */
  as?: "div" | "p" | "span" | "legend" | "li" | "h2" | "h3" | "h4" | "h5" | "h6" | undefined;
  /** An icon (IconDef, emoji, node) before the text. */
  icon?: unknown | undefined;
  /** A number (or any node) after the text: how many items the group has. */
  count?: MaybeFn<unknown> | undefined;
  /** The end side: a small button, a link. */
  actions?: MaybeFn<unknown> | undefined;
  /** Uppercase with wide tracking (default true); false keeps the text as written. */
  upper?: MaybeFn<boolean | undefined>;
  /** sm: inside menus and dense panels (default); md: a little larger. */
  size?: MaybeFn<"sm" | "md" | undefined>;
  /** A thin rule after the text that fills the row. */
  rule?: MaybeFn<boolean | undefined>;
  /** Theme colour of the text (default: faint). */
  color?: ColorToken | undefined;
  class?: ClassProp | undefined;
  children?: unknown | undefined;
  [attr: string]: unknown;
}

const USED = ["label", "as", "icon", "count", "actions", "upper", "size", "rule", "color"] as const;

/** `<SectionLabel icon={star} count={3} actions={<IconButton size="sm" icon={plus} label="Add" />}>Favorites</SectionLabel>` */
export function SectionLabel(props: SectionLabelProps): Element {
  return h(props.as ?? "div", {
    ...rest(props, USED),
    class: () => cx("hm-section-label", `hm-section-label-${val(props.size) ?? "sm"}`, val(props.upper) === false && "is-plain", val(props.class)),
    "data-hm-color": colorAttr(props.color),
  },
  props.icon != null && props.icon !== false ? icon(props.icon, "hm-section-label-icon") : null,
  h("span", { class: "hm-section-label-text" }, props.label != null ? () => val(props.label) : props.children),
  props.count != null ? h("span", { class: "hm-section-label-count" }, () => val(props.count)) : null,
  () => (val(props.rule) ? h("span", { class: "hm-section-label-rule", "aria-hidden": "true" }) : null),
  props.actions != null ? h("span", { class: "hm-section-label-actions" }, () => val(props.actions)) : null);
}
