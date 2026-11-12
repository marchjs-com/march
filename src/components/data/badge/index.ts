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
  dot?: boolean;
  class?: ClassProp;
  children?: unknown;
}
/** `<Badge tone="success">Active</Badge>`, `<Badge count={n} />` (hidden at 0 unless showZero; 120 → "99+"). */
export function Badge(props: BadgeProps): unknown {
  if (props.count !== undefined) {
    return () => {
      const n = Number(val(props.count)) || 0;
      if (!n && !props.showZero) return null;
      return h("span", { "data-hm-color": () => colorAttr(props.color), class: cx("hm-badge", "hm-badge-count", `hm-badge-${val(props.tone) ?? "danger"}`, val(props.class)), "aria-label": props.label ? `${n} ${val(props.label)}` : null }, countLabel(n, props.max ?? 99));
    };
  }
  return h("span", { "data-hm-color": () => colorAttr(props.color), class: () => cx("hm-badge", `hm-badge-${val(props.tone) ?? "neutral"}`, props.dot && "hm-badge-dot", val(props.class)) }, props.children);
}
