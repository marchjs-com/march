// Chip (hadi-march/ui): a label pill — static, toggle (filters) or removable. Folder: src/components/actions/chip/.
import "./chip.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { IconButton } from "../icon-button/index.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { OverflowText } from "../../../ui/marquee.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export interface ChipProps {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  tone?: MaybeFn<"neutral" | "primary" | "success" | "warn" | "danger" | "info" | undefined>;
  icon?: unknown;
  /** Toggle chip (filters): pressed state. */
  selected?: MaybeFn<boolean | undefined>;
  /** The tick of a selected chip: true (default), false (the chip's own icon stays), or your own node / icon. */
  selectedIcon?: unknown;
  onClick?: (e: MouseEvent) => void;
  onRemove?: () => void;
  /** Accessible name of the remove button (default: "Remove", translated). */
  removeLabel?: MaybeFn<string | undefined>;
  /** Icon of the remove button (default: ×): your own node / icon. */
  removeIcon?: unknown;
  size?: "sm" | "md";
  class?: ClassProp;
  children?: unknown;
}
/** `<Chip icon={tag}>Design</Chip>`, filter chips `<Chip selected={$on} onClick={…}>`, removable `<Chip onRemove={…}>`. */
export function Chip(props: ChipProps): Element {
  const toggle = props.selected !== undefined || props.onClick != null;
  const cls = (): string => cx("hm-chip2", `hm-chip2-${val(props.tone) ?? "neutral"}`, props.size === "sm" && "hm-chip2-sm", toggle && "hm-chip2-btn", val(props.selected) && "is-selected", val(props.class));
  const body = [
    () => (!toggle || !val(props.selected) || props.selectedIcon === false ? icon(props.icon, "hm-chip2-icon")
      : h("span", { class: "hm-chip2-icon", "aria-hidden": "true" }, ownIcon(props.selectedIcon ?? undefined, check, "hm-chip2-own"))),
    h(OverflowText, { class: "hm-chip2-label" }, props.children),
  ];
  const remove = props.onRemove && h(IconButton, { size: "xs", shape: "round", class: "hm-chip2-x", title: false, label: () => val(props.removeLabel) ?? t`Remove`, onClick: (e: Event) => { e.stopPropagation(); props.onRemove?.(); },
    icon: ownIcon(props.removeIcon ?? undefined, xIcon, "hm-chip2-own") });
  if (toggle) return h("span", { "data-hm-color": () => colorAttr(props.color), class: cls }, h("button", { type: "button", class: "hm-chip2-hit", "aria-pressed": () => (props.selected !== undefined ? String(!!val(props.selected)) : null), onClick: (e: MouseEvent) => props.onClick?.(e) }, body), remove);
  return h("span", { "data-hm-color": () => colorAttr(props.color), class: cls }, body, remove);
}
