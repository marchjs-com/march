// Alert / Notice (hadi-march/feedback): a message in one of the tones, with an optional title, icon and dismiss button.
import "./alert.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import type { IconDef } from "../../../icons/svg.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { info } from "../../../icons/glyphs/info.ts";
import { checkCircle } from "../../../icons/glyphs/checkCircle.ts";
import { alertTriangle } from "../../../icons/glyphs/alertTriangle.ts";
import { alertCircle } from "../../../icons/glyphs/alertCircle.ts";
import { actionsOf, type ActionsProp, type Tone } from "../../../ui/display-base.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export interface AlertProps {
  tone?: MaybeFn<Tone | undefined>;
  title?: unknown;
  icon?: unknown;
  body?: unknown;
  /** The next step: a node, a list of nodes or `action()` objects (drawn as small buttons). */
  action?: ActionsProp;
  /** Where the actions sit: "end" (default: beside the text, before the dismiss button) or "below" the text. */
  actionPlacement?: "end" | "below" | undefined;
  dismissable?: boolean;
  /** Accessible name of the dismiss button (default "Dismiss", translated). */
  dismissLabel?: MaybeFn<string | undefined>;
  /** Glyph or node inside the dismiss button (default: the × glyph). */
  dismissIcon?: unknown;
  /** Theme color token instead of the tone's colours ("brand-purple", "cat-3"…); the role still follows `tone`. */
  color?: ColorToken | undefined;
  onDismiss?: () => void;
  /** "soft" (default: the tone's tinted fill) or "raised": a floating message (a toast) on the surface of a layer with a shadow; the tone colours the icon alone. */
  variant?: "soft" | "raised" | undefined;
  /** The ARIA role instead of the tone's ("alert" for danger and warn, "status" otherwise). */
  role?: string | undefined;
  /** Extra classes of the parts (the host's own hooks): the icon, the body, the dismiss button. */
  partClass?: { icon?: string; body?: string; dismiss?: string } | undefined;
  class?: ClassProp;
  children?: unknown;
}
const TONE_ICON: Record<string, IconDef> = { info, success: checkCircle, warn: alertTriangle, danger: alertCircle, neutral: info };
/** The icon of a tone (info, success, warn, danger, neutral), shared by everything that shows a message in a tone (Alert, Toast). */
export const toneIcon = (tone: string | null | undefined): IconDef => TONE_ICON[tone ?? "info"] ?? info;

/** `<Alert tone="warn" title="Heads up" dismissable onDismiss={…}>Body</Alert>`, `<Alert tone="danger" action={<Button size="sm">Retry</Button>}>…</Alert>` (alias Notice). */
export function Alert(props: AlertProps): () => unknown {
  const shown = signal(true);
  return () => shown() && untrack(() => {
    const tone = val(props.tone) ?? "info";
    const below = props.actionPlacement === "below";
    const actions = props.action != null && h("div", { class: cx("m-alert-action", below && "m-alert-action-below") }, actionsOf(() => props.action));
    const part = props.partClass ?? {};
    return h("div", { class: () => cx("m-alert", `m-alert-${val(props.tone) ?? "info"}`, props.variant === "raised" && "m-alert-raised", val(props.class)), role: props.role ?? (tone === "danger" || tone === "warn" ? "alert" : "status"), "data-m-color": () => colorAttr(props.color) },
      icon(props.icon === undefined ? toneIcon(tone) : props.icon, cx("m-alert-icon", part.icon)),
      h("div", { class: "m-alert-main" },
        props.title != null && h("strong", { class: "m-alert-title" }, () => val(props.title)),
        h("div", { class: cx("m-alert-body", part.body) }, props.body ?? props.children),
        below && actions),
      !below && actions,
      props.dismissable && h(IconButton, { size: "sm", class: cx("m-alert-x", part.dismiss), title: false, label: () => val(props.dismissLabel) ?? t`Dismiss`, onClick: () => { shown.set(false); props.onDismiss?.(); }, icon: ownIcon(props.dismissIcon, xIcon, "m-alert-x-icon") }));
  });
}
/** Alias of Alert. */
export const Notice = Alert;
