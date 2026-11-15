// MadeWithMarch (march/ui): an optional "Developed with MarchJS and 💗" line. Folder: src/components/made-with-march/.
import "./made-with-march.css";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

messages("tr", { "Developed with {0}": "{0} ile geliştirildi" });

import { MARCH_URL } from "../../../brand.js";
/** Where "MarchJS" links point: one constant in src/brand.js (shared with the console banner). */
export { MARCH_URL };

export interface MadeWithMarchProps {
  /** `text` (plain line, default), `badge` (bordered pill), `small` (compact, muted). @tr `text` (düz satır, varsayılan), `badge` (kenarlıklı hap), `small` (sıkışık, soluk). */
  variant?: MaybeFn<"text" | "badge" | "small" | undefined>;
  /** The heart: true (default 💗), false (the sentence ends at the link), or your own node / text. @tr Kalp: true (varsayılan 💗), false (cümle bağlantıda biter) ya da kendi düğümün / metnin. */
  heart?: unknown;
  /** Accessible name of the heart (default: "Love", translated). @tr Kalbin erişilebilir adı (varsayılan: "Love", çevrilir). */
  heartLabel?: MaybeFn<string | undefined>;
  /** Text of the link (default: "MarchJS"). @tr Bağlantının metni (varsayılan: "MarchJS"). */
  link?: unknown;
  /** Where the link points (default: MARCH_URL). @tr Bağlantının adresi (varsayılan: MARCH_URL). */
  href?: string | undefined;
  /** Your own sentence around the two parts: `(link, heart) => content` (heart is null when turned off). @tr İki parçanın çevresindeki kendi cümlen: `(link, heart) => içerik` (kalp kapalıysa heart null). */
  text?: ((link: Element, heart: Element | null) => unknown) | undefined;
  /** Extra classes on the line. @tr Satıra eklenen sınıflar. */
  class?: ClassProp;
}

const LINK = "\u0001", HEART = "\u0002";

/** `<MadeWithMarch />`, `<MadeWithMarch variant="badge" />`. The sentence is one i18n message, so word order follows the language. */
export function MadeWithMarch(props: MadeWithMarchProps): Element {
  const link = (): Element => h("a", { class: "m-madewith-link", href: props.href ?? MARCH_URL, target: "_blank", rel: "noopener" }, props.link ?? "MarchJS") as Element;
  const heart = (): Element | null => (props.heart === false ? null
    : h("span", { class: "m-madewith-heart", role: "img", "aria-label": () => val(props.heartLabel) ?? t`Love` }, props.heart == null || props.heart === true ? "💗" : props.heart) as Element);
  const parts = (): unknown => {
    if (props.text) return props.text(link(), heart());
    const sentence = props.heart === false ? t`Developed with ${LINK}` : t`Developed with ${LINK} and ${HEART}`;
    return sentence.split(/([\u0001\u0002])/).map((s) => (s === LINK ? link() : s === HEART ? heart() : s));
  };
  return h("p", { class: () => cx("m-madewith", `m-madewith-${val(props.variant) ?? "text"}`, val(props.class)) }, parts);
}
