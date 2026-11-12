// Badge and count labels. (hadi-march/ui; split from display.ts so each component is its own module and chunk).
import "./display.css";
import { h } from "../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "./util.ts";
import type { Tone } from "./display-base.ts";

/** Format a count for badges: 120 → "99+". */
export const countLabel = (n: number, max = 99): string => (n > max ? `${max}+` : String(n));

export interface BadgeProps {
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
      return h("span", { class: cx("hm-badge", "hm-badge-count", `hm-badge-${val(props.tone) ?? "danger"}`, val(props.class)), "aria-label": props.label ? `${n} ${val(props.label)}` : null }, countLabel(n, props.max ?? 99));
    };
  }
  return h("span", { class: () => cx("hm-badge", `hm-badge-${val(props.tone) ?? "neutral"}`, props.dot && "hm-badge-dot", val(props.class)) }, props.children);
}
