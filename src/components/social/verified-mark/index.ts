// VerifiedMark (hadi-march/social): the "verified account" badge beside a name (post author, profile header, user
// row). An image with a name screen readers read ("Verified"); the icon, the text, the colour and the size are yours.
import "./verified-mark.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { badgeCheck } from "../../../icons/glyphs/badgeCheck.ts";

export interface VerifiedMarkProps {
  /** Accessible name (default "Verified"); `false`: decorative (the text beside it says it). @tr Erişilebilir ad (varsayılan "Doğrulanmış"); `false`: süs amaçlı (yanındaki metin zaten söyler). */
  label?: MaybeFn<string | false | undefined>;
  /** Own icon (an icon of hadi-march/icons, text or a node). @tr Kendi ikonunuz (hadi-march/icons'tan bir ikon, metin ya da düğüm). */
  icon?: unknown;
  /** sm (beside body text, default) · md (beside a heading) · lg. @tr sm (gövde metninin yanında, varsayılan) · md (başlığın yanında) · lg. */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** Extra class on the mark. @tr İşarete eklenen sınıf. */
  class?: ClassProp;
  /** Other attributes (`data-*`, `title`, `id`) go to the mark. */
  [attr: string]: unknown;
}

/** `<VerifiedMark />`, `<VerifiedMark size="md" label="Verified organiser" color="brand-green" icon={shieldCheck} />` */
export function VerifiedMark(props: VerifiedMarkProps): Element {
  const label = (): string | null => { const l = val(props.label); return l === false ? null : l || t`Verified`; };
  return h("span", {
    ...rest(props, ["label", "icon", "color", "size"]),
    class: () => cx("m-verified-mark", `m-verified-mark-${val(props.size) ?? "sm"}`, val(props.class)),
    role: () => (label() == null ? null : "img"), "aria-label": label, "aria-hidden": () => (label() == null ? "true" : null),
  }, ownIcon(props.icon ?? undefined, badgeCheck, "m-verified-mark-own"));
}
