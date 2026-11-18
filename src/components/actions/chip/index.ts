// Chip (march/ui): a label pill — static, toggle (filters) or removable. Folder: src/components/actions/chip/.
import "./chip.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { IconButton } from "../icon-button/index.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { OverflowText } from "../../../ui/marquee.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import type { IconProp } from "../../../icons/types.ts";

export interface ChipProps {
  /** Colour family: neutral (default), primary, success, warn, danger or info. @tr Renk ailesi: neutral (varsayılan), primary, success, warn, danger ya da info. */
  tone?: MaybeFn<"neutral" | "primary" | "success" | "warn" | "danger" | "info" | undefined>;
  /** A leading icon (a tick replaces it while selected). @tr Baştaki ikon (seçiliyken yerini bir tik alır). */
  icon?: IconProp;
  /** Toggle chip (filters): pressed state. @tr Aç / kapa çip (filtreler): basılı durumu. */
  selected?: MaybeFn<boolean | undefined>;
  /** The tick of a selected chip: true (default), false (the chip's own icon stays), or your own node / icon. @tr Seçili çipin tiki: true (varsayılan), false (çipin kendi ikonu kalır) ya da kendi düğümün / ikonun. */
  selectedIcon?: IconProp;
  /** Called on click; with `selected` the chip is a toggle button. @tr Tıklayınca çağrılır; `selected` ile çip aç / kapa düğmesi olur. */
  onClick?: (e: MouseEvent) => void;
  /** Adds the remove button; called when it is pressed. @tr Kaldırma düğmesini ekler; ona basılınca çağrılır. */
  onRemove?: () => void;
  /** Accessible name of the remove button (default: "Remove", translated). @tr Kaldırma düğmesinin erişilebilir adı (varsayılan: "Remove", çevrilir). */
  removeLabel?: MaybeFn<string | undefined>;
  /** Icon of the remove button (default: ×): your own node / icon. @tr Kaldırma düğmesinin ikonu (varsayılan: ×): kendi düğümün / ikonun. */
  removeIcon?: IconProp;
  /** sm or md (default). @tr sm ya da md (varsayılan). */
  size?: "sm" | "md";
  /** Extra classes on the chip. @tr Çipe eklenen sınıflar. */
  class?: ClassProp;
  /** The label. @tr Etiket. */
  children?: unknown;
}
/** `<Chip icon={tag}>Design</Chip>`, filter chips `<Chip selected={$on} onClick={…}>`, removable `<Chip onRemove={…}>`. */
export function Chip(props: ChipProps): Element {
  const toggle = props.selected !== undefined || props.onClick != null;
  const cls = (): string => cx("m-chip2", `m-chip2-${val(props.tone) ?? "neutral"}`, props.size === "sm" && "m-chip2-sm", toggle && "m-chip2-btn", val(props.selected) && "is-selected", val(props.class));
  const body = [
    () => (!toggle || !val(props.selected) || props.selectedIcon === false ? icon(props.icon, "m-chip2-icon")
      : h("span", { class: "m-chip2-icon", "aria-hidden": "true" }, ownIcon(props.selectedIcon ?? undefined, check, "m-chip2-own"))),
    h(OverflowText, { class: "m-chip2-label" }, props.children),
  ];
  const remove = props.onRemove && h(IconButton, { size: "xs", shape: "round", class: "m-chip2-x", title: false, label: () => val(props.removeLabel) ?? t`Remove`, onClick: (e: Event) => { e.stopPropagation(); props.onRemove?.(); },
    icon: ownIcon(props.removeIcon ?? undefined, xIcon, "m-chip2-own") });
  if (toggle) return h("span", { class: cls }, h("button", { type: "button", class: "m-chip2-hit", "aria-pressed": () => (props.selected !== undefined ? String(!!val(props.selected)) : null), onClick: (e: MouseEvent) => props.onClick?.(e) }, body), remove);
  return h("span", { class: cls }, body, remove);
}
