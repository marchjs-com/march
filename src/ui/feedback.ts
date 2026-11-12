// Empty, Spinner, ErrorBox, Skeleton, Alert (Notice). (hadi-march/ui; split from display.ts so each component is its own module and chunk).
import "./display.css";
import { signal, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { val, cx, icon, glyph, type MaybeFn, type ClassProp } from "./util.ts";
import { x as xIcon } from "../icons/glyphs/x.ts";
import { info } from "../icons/glyphs/info.ts";
import { checkCircle } from "../icons/glyphs/checkCircle.ts";
import { alertTriangle } from "../icons/glyphs/alertTriangle.ts";
import { alertCircle } from "../icons/glyphs/alertCircle.ts";
import { type ActionsProp, type Tone, actionsOf } from "./display-base.ts";
import { colorList, tokenColor, type MultiColors } from "../theme/colors.ts";

export interface EmptyProps { icon?: unknown; title?: MaybeFn<string | undefined>; action?: ActionsProp; class?: ClassProp; children?: unknown }
/** `<Empty icon="📭" title="No users yet" action={…}>Invite someone to get started.</Empty>` */
export function Empty(props: EmptyProps): Element {
  return h("div", { class: () => cx("hm-empty", val(props.class)) },
    icon(props.icon, "hm-empty-icon"),
    h("p", { class: "hm-empty-title" }, () => val(props.title) ?? t`Nothing here yet`),
    props.children != null && h("div", { class: "hm-empty-text" }, props.children),
    props.action != null && h("div", { class: "hm-empty-action" }, actionsOf(() => props.action)));
}

export interface SpinnerProps {
  size?: "sm" | "md" | "lg"; label?: MaybeFn<string | undefined>; class?: ClassProp;
  /** "brand", a list of color tokens, or "single" (one color in a multicolor theme). */
  colors?: MultiColors | undefined;
}
/** `<Spinner size="sm" label="Loading users" />` */
export function Spinner(props: SpinnerProps): Element {
  const el = h("span", { class: () => cx("hm-loading", props.size && `hm-spin-${props.size}`, props.colors === "single" && "hm-spin-single", val(props.class)), role: "status", "aria-label": () => val(props.label) ?? t`Loading` }) as HTMLElement;
  const list = colorList(props.colors);
  if (list) { el.style.setProperty("--hm-spinner-paint", `conic-gradient(from 0deg, transparent 0 8%, ${list.map(tokenColor).join(", ")})`); el.style.setProperty("--hm-spinner-track", "transparent"); el.style.setProperty("--hm-spinner-head", "transparent"); }
  return el;
}

export interface ErrorBoxProps {
  error?: MaybeFn<unknown>;
  message?: MaybeFn<unknown>;
  title?: unknown;
  retry?: () => unknown;
  class?: ClassProp;
}
/** `<ErrorBox error={err} retry={() => refetch()} title="Could not load" />` */
export function ErrorBox(props: ErrorBoxProps): Element {
  const msg = (): string => {
    const e = val(props.error) ?? val(props.message);
    const m = e != null && typeof e === "object" ? (e as { message?: unknown }).message : undefined;
    return (m as string | undefined) ?? (e != null ? String(e) : t`Something went wrong.`);
  };
  return h("div", { class: () => cx("hm-error", "hm-errorbox", val(props.class)), role: "alert" },
    props.title != null && h("strong", { class: "hm-errorbox-title" }, () => val(props.title)),
    h("p", {}, msg),
    props.retry && h("button", { type: "button", class: "hm-btn hm-btn-secondary hm-btn-sm", onClick: () => props.retry?.() }, () => t`Retry`));
}

export interface SkeletonProps { lines?: number; block?: boolean; height?: "sm" | "md" | "lg"; class?: string; /** "single": a neutral shimmer even in a multicolor theme. */ colors?: "single" | "brand" | undefined }
/** Placeholder while loading: `<Skeleton lines={3} />`, `<Skeleton block height="lg" />`. */
export function Skeleton(props: SkeletonProps): Element {
  const tint = props.colors === "single" ? "hm-skel-single" : props.colors === "brand" ? "hm-skel-brand" : null;
  if (props.block) return h("div", { class: cx("hm-skel", "hm-skel-block", `hm-skel-${props.height ?? "md"}`, tint, props.class), "aria-hidden": "true" });
  const n = props.lines ?? 3;
  return h("div", { class: cx("hm-skel-lines", tint, props.class), "aria-busy": "true", "aria-label": t`Loading` },
    Array.from({ length: n }, (_, i) => h("span", { class: cx("hm-skel", "hm-skel-line", i === n - 1 && n > 1 && "hm-skel-short") })));
}

export interface AlertProps {
  tone?: MaybeFn<Tone | undefined>;
  title?: unknown;
  icon?: unknown;
  body?: unknown;
  dismissable?: boolean;
  onDismiss?: () => void;
  class?: ClassProp;
  children?: unknown;
}
/** `<Alert tone="warn" title="Heads up" dismissable onDismiss={…}>Body</Alert>` (alias Notice). */
export function Alert(props: AlertProps): () => unknown {
  const shown = signal(true);
  return () => shown() && untrack(() => {
    const tone = val(props.tone) ?? "info";
    return h("div", { class: () => cx("hm-alert", `hm-alert-${val(props.tone) ?? "info"}`, val(props.class)), role: tone === "danger" || tone === "warn" ? "alert" : "status" },
      icon(props.icon === undefined ? TONE_ICON[tone] ?? info : props.icon, "hm-alert-icon"),
      h("div", { class: "hm-alert-main" },
        props.title != null && h("strong", { class: "hm-alert-title" }, () => val(props.title)),
        h("div", { class: "hm-alert-body" }, props.body ?? props.children)),
      props.dismissable && h("button", { type: "button", class: "hm-icon-btn hm-alert-x", "aria-label": () => t`Dismiss`, onClick: () => { shown.set(false); props.onDismiss?.(); } }, glyph(xIcon)));
  });
}
export const Notice = Alert;
const TONE_ICON: Record<string, typeof info> = { info, success: checkCircle, warn: alertTriangle, danger: alertCircle, neutral: info };
