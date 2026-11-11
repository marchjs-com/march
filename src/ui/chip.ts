// Chip (hadi-march/ui).
import "./chip.css";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { val, cx, icon, glyph, type MaybeFn, type ClassProp } from "./util.ts";
import { x as xIcon, check } from "../icons/set.ts";
import { OverflowText } from "./marquee.ts";

export interface ChipProps {
  tone?: MaybeFn<"neutral" | "primary" | "success" | "warn" | "danger" | "info" | undefined>;
  icon?: unknown;
  /** Toggle chip (filters): pressed state. */
  selected?: MaybeFn<boolean | undefined>;
  onClick?: (e: MouseEvent) => void;
  onRemove?: () => void;
  size?: "sm" | "md";
  class?: ClassProp;
  children?: unknown;
}
/** `<Chip icon={tag}>Design</Chip>`, filter chips `<Chip selected={$on} onClick={…}>`, removable `<Chip onRemove={…}>`. */
export function Chip(props: ChipProps): Element {
  const toggle = props.selected !== undefined || props.onClick != null;
  const cls = (): string => cx("hm-chip2", `hm-chip2-${val(props.tone) ?? "neutral"}`, props.size === "sm" && "hm-chip2-sm", toggle && "hm-chip2-btn", val(props.selected) && "is-selected", val(props.class));
  const body = [
    () => (toggle && val(props.selected) ? h("span", { class: "hm-chip2-icon" }, glyph(check)) : icon(props.icon, "hm-chip2-icon")),
    h(OverflowText, { class: "hm-chip2-label" }, props.children),
  ];
  const remove = props.onRemove && h("button", { type: "button", class: "hm-chip2-x", "aria-label": () => t`Remove`, onClick: (e: Event) => { e.stopPropagation(); props.onRemove?.(); } }, glyph(xIcon));
  if (toggle) return h("span", { class: cls }, h("button", { type: "button", class: "hm-chip2-hit", "aria-pressed": () => (props.selected !== undefined ? String(!!val(props.selected)) : null), onClick: (e: MouseEvent) => props.onClick?.(e) }, body), remove);
  return h("span", { class: cls }, body, remove);
}
