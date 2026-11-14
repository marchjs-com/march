// Alert / Notice (hadi-march/feedback): a message in one of the tones, with an optional title, icon and dismiss button.
import "./alert.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, icon, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { info } from "../../../icons/glyphs/info.ts";
import { checkCircle } from "../../../icons/glyphs/checkCircle.ts";
import { alertTriangle } from "../../../icons/glyphs/alertTriangle.ts";
import { alertCircle } from "../../../icons/glyphs/alertCircle.ts";
import type { Tone } from "../../../ui/display-base.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export interface AlertProps {
  tone?: MaybeFn<Tone | undefined>;
  title?: unknown;
  icon?: unknown;
  body?: unknown;
  dismissable?: boolean;
  /** Accessible name of the dismiss button (default "Dismiss", translated). */
  dismissLabel?: MaybeFn<string | undefined>;
  /** Glyph or node inside the dismiss button (default: the × glyph). */
  dismissIcon?: unknown;
  /** Theme color token instead of the tone's colours ("brand-purple", "cat-3"…); the role still follows `tone`. */
  color?: ColorToken | undefined;
  onDismiss?: () => void;
  class?: ClassProp;
  children?: unknown;
}
/** `<Alert tone="warn" title="Heads up" dismissable onDismiss={…}>Body</Alert>` (alias Notice). */
export function Alert(props: AlertProps): () => unknown {
  const shown = signal(true);
  return () => shown() && untrack(() => {
    const tone = val(props.tone) ?? "info";
    return h("div", { class: () => cx("hm-alert", `hm-alert-${val(props.tone) ?? "info"}`, val(props.class)), role: tone === "danger" || tone === "warn" ? "alert" : "status", "data-hm-color": () => colorAttr(props.color) },
      icon(props.icon === undefined ? TONE_ICON[tone] ?? info : props.icon, "hm-alert-icon"),
      h("div", { class: "hm-alert-main" },
        props.title != null && h("strong", { class: "hm-alert-title" }, () => val(props.title)),
        h("div", { class: "hm-alert-body" }, props.body ?? props.children)),
      props.dismissable && h("button", { type: "button", class: "hm-icon-btn hm-alert-x", "aria-label": () => val(props.dismissLabel) ?? t`Dismiss`, onClick: () => { shown.set(false); props.onDismiss?.(); } }, props.dismissIcon === undefined ? glyph(xIcon) : icon(props.dismissIcon, "hm-alert-x-icon")));
  });
}
/** Alias of Alert. */
export const Notice = Alert;
const TONE_ICON: Record<string, typeof info> = { info, success: checkCircle, warn: alertTriangle, danger: alertCircle, neutral: info };
