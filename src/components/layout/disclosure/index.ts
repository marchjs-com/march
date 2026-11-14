// Disclosure: a collapsible section built on native <details>/<summary> (keyboard and screen reader support for free).
//   <Disclosure title="Advanced" open={false} onToggle={(open) => …}>…</Disclosure>
import "./disclosure.css";
import { h } from "../../../dom/h.ts";
import { read } from "../../../core/reactive.ts";
import { cx, val, type ClassProp } from "../../../core/util.ts";
import { Chevron } from "../../actions/chevron/index.ts";

export interface DisclosureProps {
  title: unknown;
  open?: boolean | (() => boolean);
  onToggle?: (open: boolean) => void;
  /** The turning arrow before the title: true (default), false, or your own node. */
  marker?: boolean | unknown;
  class?: ClassProp;
  children?: unknown;
}

/** A native <details> section with an animated open/close and a summary line. */
export function Disclosure(props: DisclosureProps): Element {
  const own = props.marker != null && props.marker !== true && props.marker !== false;
  const el = h("details", { class: () => cx("hm-disclosure", (own || props.marker === false) && "hm-disclosure-no-marker", val(props.class)), open: () => !!read(props.open ?? false) },
    h("summary", { class: "hm-disclosure-summary" }, own ? h("span", { class: "hm-disclosure-marker", "aria-hidden": "true" }, props.marker) : props.marker === false ? null : h(Chevron, { class: "hm-disclosure-chev" }), () => props.title),
    h("div", { class: "hm-disclosure-body" }, () => props.children)) as HTMLDetailsElement;
  el.addEventListener("toggle", () => props.onToggle?.(el.open));
  return el;
}
