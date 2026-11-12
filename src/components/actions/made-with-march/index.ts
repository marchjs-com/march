// MadeWithMarch (hadi-march/ui): an optional "Developed with March and 💗" line. Folder: src/components/made-with-march/.
import "./made-with-march.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

import { MARCH_URL } from "../../../brand.js";
/** Where "March" links point: one constant in src/brand.js (shared with the console banner). */
export { MARCH_URL };

export interface MadeWithMarchProps {
  /** `text` (plain line, default), `badge` (bordered pill), `small` (compact, muted). */
  variant?: MaybeFn<"text" | "badge" | "small" | undefined>;
  class?: ClassProp;
}

const LINK = "\u0001", HEART = "\u0002";

/** `<MadeWithMarch />`, `<MadeWithMarch variant="badge" />`. The sentence is one i18n message, so word order follows the language. */
export function MadeWithMarch(props: MadeWithMarchProps): Element {
  const parts = (): unknown[] => t`Developed with ${LINK} and ${HEART}`.split(/([\u0001\u0002])/).map((s) =>
    s === LINK ? h("a", { class: "hm-madewith-link", href: MARCH_URL, target: "_blank", rel: "noopener" }, "March")
    : s === HEART ? h("span", { class: "hm-madewith-heart", role: "img", "aria-label": () => t`Love` }, "💗")
    : s);
  return h("p", { class: () => cx("hm-madewith", `hm-madewith-${val(props.variant) ?? "text"}`, val(props.class)) }, parts);
}
