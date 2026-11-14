// Badge and count labels (hadi-march/ui). Folder: src/components/data/badge/.
import "./badge.css";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { Tone } from "../../../ui/display-base.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

/** Format a count for badges: 120 → "99+". */
export const countLabel = (n: number, max = 99): string => (n > max ? `${max}+` : String(n));

export interface BadgeProps {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  tone?: MaybeFn<Tone | undefined>;
  /** Count badge: hidden at 0 unless `showZero`; above `max` shows "99+". */
  count?: MaybeFn<number | null | undefined>;
  max?: number;
  showZero?: boolean;
  /** Count badges: accessible label after the number ("3 unread"). */
  label?: MaybeFn<string>;
  /** Dot before the text: `true` draws the built-in dot, a node is your own mark. */
  dot?: boolean | Node | undefined;
  /** Colour of the built-in dot (default: the text colour of the tone). */
  dotColor?: ColorToken | undefined;
  /** Count badges: your own text for the number (default `countLabel`: 120 → "99+"). */
  format?: ((n: number, max: number) => unknown) | undefined;
  class?: ClassProp;
  children?: unknown;
}
/** `<Badge tone="success">Active</Badge>`, `<Badge count={n} />` (hidden at 0 unless showZero; 120 → "99+"). */
export function Badge(props: BadgeProps): unknown {
  if (props.count !== undefined) {
    return () => {
      const n = Number(val(props.count)) || 0;
      if (!n && !props.showZero) return null;
      return h("span", { "data-hm-color": () => colorAttr(props.color), class: cx("hm-badge", "hm-badge-count", `hm-badge-${val(props.tone) ?? "danger"}`, val(props.class)), "aria-label": props.label ? `${n} ${val(props.label)}` : null }, props.format ? props.format(n, props.max ?? 99) : countLabel(n, props.max ?? 99));
    };
  }
  // the dot: the built-in one (a pseudo-element, or a coloured mark with `dotColor`) or the caller's node
  const own = props.dot && props.dot !== true, mark = props.dot === true && !!props.dotColor;
  return h("span", { "data-hm-color": () => colorAttr(props.color), class: () => cx("hm-badge", `hm-badge-${val(props.tone) ?? "neutral"}`, props.dot === true && !mark && "hm-badge-dot", val(props.class)) },
    own ? h("span", { class: "hm-badge-dot-own", "aria-hidden": "true" }, props.dot) : mark ? h("span", { class: "hm-badge-dot-mark", "aria-hidden": "true", "data-hm-color": colorAttr(props.dotColor) }) : null,
    props.children);
}
