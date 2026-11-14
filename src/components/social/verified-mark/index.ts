// VerifiedMark (hadi-march/social): the "verified account" badge beside a name (post author, profile header, user
// row). An image with a name screen readers read ("Verified"); the icon, the text, the colour and the size are yours.
import "./verified-mark.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { badgeCheck } from "../../../icons/glyphs/badgeCheck.ts";

export interface VerifiedMarkProps {
  /** Accessible name (default "Verified"); `false`: decorative (the text beside it says it). */
  label?: MaybeFn<string | false | undefined>;
  /** Own icon (an icon of hadi-march/icons, text or a node). */
  icon?: unknown;
  /** Theme colour token (default: the brand blue). */
  color?: MaybeFn<ColorToken | undefined>;
  /** sm (beside body text, default) · md (beside a heading) · lg. */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  class?: ClassProp;
  /** Other attributes (`data-*`, `title`, `id`) go to the mark. */
  [attr: string]: unknown;
}

/** `<VerifiedMark />`, `<VerifiedMark size="md" label="Verified organiser" color="brand-green" icon={shieldCheck} />` */
export function VerifiedMark(props: VerifiedMarkProps): Element {
  const label = (): string | null => { const l = val(props.label); return l === false ? null : l || t`Verified`; };
  return h("span", {
    ...rest(props, ["label", "icon", "color", "size"]),
    class: () => cx("hm-verified-mark", `hm-verified-mark-${val(props.size) ?? "sm"}`, val(props.class)),
    "data-hm-color": () => colorAttr(val(props.color)),
    role: () => (label() == null ? null : "img"), "aria-label": label, "aria-hidden": () => (label() == null ? "true" : null),
  }, ownIcon(props.icon ?? undefined, badgeCheck, "hm-verified-mark-own"));
}
