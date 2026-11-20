// Disclosure: a collapsible section built on native <details>/<summary> (keyboard and screen reader support for free).
//   <Disclosure title="Advanced" open={false} onToggle={(open) => …}>…</Disclosure>
import "./disclosure.css";
import { h } from "../../../dom/h.ts";
import { read } from "../../../core/reactive.ts";
import { cx, val, type ClassProp, type Handler } from "../../../core/util.ts";
import { Chevron } from "../../actions/chevron/index.ts";

export interface DisclosureProps {
  /** The always visible summary line. @tr Her zaman görünen özet satırı. */
  title: unknown;
  /** Open at first, or a live accessor (default false). @tr Başta açık mı, ya da canlı bir erişimci (varsayılan false). */
  open?: boolean | (() => boolean);
  /** Called with the new state when it opens or closes. @tr Açılınca ya da kapanınca yeni durumla çağrılır. */
  onToggle?: Handler<[open: boolean]> | undefined;
  /** The turning arrow before the title: true (default), false, or your own node. @tr Başlıktan önceki dönen ok: true (varsayılan), false ya da kendi düğümünüz. */
  marker?: boolean | unknown;
  /** Extra class on the root (`.m-disclosure`). @tr Köke (`.m-disclosure`) eklenen sınıf. */
  class?: ClassProp;
  /** The content shown when open. @tr Açıkken gösterilen içerik. */
  children?: unknown;
}

/** A native <details> section with an animated open/close and a summary line. */
export function Disclosure(props: DisclosureProps): Element {
  const own = props.marker != null && props.marker !== true && props.marker !== false;
  const el = h("details", { class: () => cx("m-disclosure", (own || props.marker === false) && "m-disclosure-no-marker", val(props.class)), open: () => !!read(props.open ?? false) },
    h("summary", { class: "m-disclosure-summary" }, own ? h("span", { class: "m-disclosure-marker", "aria-hidden": "true" }, props.marker) : props.marker === false ? null : h(Chevron, { class: "m-disclosure-chev" }), () => props.title),
    h("div", { class: "m-disclosure-body" }, () => props.children)) as HTMLDetailsElement;
  el.addEventListener("toggle", () => props.onToggle?.(el.open));
  return el;
}
