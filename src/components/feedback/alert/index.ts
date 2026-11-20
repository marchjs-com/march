// Alert / Notice (march/feedback): a message in one of the tones, with an optional title, icon and dismiss button.
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
import { type ColorToken } from "../../../theme/colors.ts";
import type { IconProp } from "../../../icons/types.ts";

export interface AlertProps {
  /** Meaning, colours and icon: info (default), success, warn, danger or neutral. @tr Anlam, renk ve ikon: info (varsayılan), success, warn, danger ya da neutral. */
  tone?: MaybeFn<Tone | undefined>;
  /** A bold first line. @tr Kalın ilk satır. */
  title?: unknown;
  /** The icon (a node or a glyph); default the tone's icon, `null` hides it. @tr İkon (düğüm ya da glif); varsayılan tonun ikonu, `null` gizler. */
  icon?: IconProp;
  /** The message (children work too). @tr Mesaj (children da olur). */
  body?: unknown;
  /** The next step: a node, a list of nodes or `action()` objects (drawn as small buttons). @tr Sonraki adım: bir düğüm, düğüm listesi ya da `action()` nesneleri (küçük düğmeler olarak çizilir). */
  action?: ActionsProp;
  /** Where the actions sit: "end" (default: beside the text, before the dismiss button) or "below" the text. @tr Eylemlerin yeri: "end" (varsayılan: metnin yanında, kapatma düğmesinden önce) ya da metnin altında "below". */
  actionPlacement?: "end" | "below" | undefined;
  /** Adds a × button that hides the alert (default false). @tr Uyarıyı gizleyen bir × düğmesi ekler (varsayılan false). */
  dismissable?: boolean;
  /** Accessible name of the dismiss button (default "Dismiss", translated). @tr Kapatma düğmesinin erişilebilir adı (varsayılan "Dismiss", çevrilir). */
  dismissLabel?: MaybeFn<string | undefined>;
  /** Glyph or node inside the dismiss button (default: the × glyph). @tr Kapatma düğmesindeki glif ya da düğüm (varsayılan: × glifi). */
  dismissIcon?: IconProp;
  /** Called after the alert is dismissed. @tr Uyarı kapatıldıktan sonra çağrılır. */
  onDismiss?: () => void;
  /** "soft" (default: the tone's tinted fill) or "raised": a floating message (a toast) on the surface of a layer with a shadow; the tone colours the icon alone. @tr "soft" (varsayılan: tonun renkli dolgusu) ya da "raised": bir katmanın yüzeyinde gölgeli, yüzen mesaj (bildirim); ton yalnız ikonu renklendirir. */
  variant?: "soft" | "raised" | undefined;
  /** The ARIA role instead of the tone's ("alert" for danger and warn, "status" otherwise). @tr Tonunki yerine ARIA rolü (danger ve warn için "alert", diğerlerinde "status"). */
  role?: string | undefined;
  /** Extra classes of the parts (the host's own hooks): the icon, the body, the dismiss button. @tr Parçalara eklenen sınıflar (ev sahibinin kendi kancaları): ikon, gövde, kapatma düğmesi. */
  partClass?: { icon?: string; body?: string; dismiss?: string } | undefined;
  /** Extra classes on the alert. @tr Uyarıya eklenen sınıflar. */
  class?: ClassProp;
  /** The message. @tr Mesaj. */
  children?: unknown;
}
const TONE_ICON: Record<string, IconDef> = { info, success: checkCircle, warn: alertTriangle, danger: alertCircle, neutral: info };
/** The icon of a tone (info, success, warn, danger, neutral), shared by everything that shows a message in a tone (Alert, Toast). */
export const toneIcon = (tone: string | null | undefined): IconDef => TONE_ICON[tone ?? "info"] ?? info;

/** `<Alert tone="warn" title="Heads up" dismissable onDismiss={…}>Body</Alert>`, `<Alert tone="danger" action={<Button size="sm">Retry</Button>}>…</Alert>` (alias Notice). */
export function Alert(props: AlertProps): () => unknown {
  const shown = signal(true);
  return () => shown() && untrack(() => {
    const tone = (): string => val(props.tone) ?? "info";
    const below = props.actionPlacement === "below";
    const actions = props.action != null && h("div", { class: cx("m-alert-action", below && "m-alert-action-below") }, actionsOf(() => props.action));
    const part = props.partClass ?? {};
    return h("div", { class: () => cx("m-alert", `m-alert-${val(props.tone) ?? "info"}`, props.variant === "raised" && "m-alert-raised", val(props.class)), role: () => props.role ?? (tone() === "danger" || tone() === "warn" ? "alert" : "status") },
      // role and icon follow a live tone
      props.icon === undefined ? () => icon(toneIcon(tone()), cx("m-alert-icon", part.icon)) : icon(props.icon, cx("m-alert-icon", part.icon)),
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
