// Disclosure: a collapsible section built on native <details>/<summary> (keyboard and screen reader support for free).
//   <Disclosure title="Advanced" open={false} onToggle={(open) => …}>…</Disclosure>
import "./disclosure.css";
import { h } from "../dom/h.ts";
import { read } from "../core/reactive.ts";

export interface DisclosureProps { title: unknown; open?: boolean | (() => boolean); onToggle?: (open: boolean) => void; class?: string; children?: unknown }

/** A native <details> section with an animated open/close and a summary line. */
export function Disclosure(props: DisclosureProps): Element {
  const el = h("details", { class: ["hm-disclosure", props.class], open: () => !!read(props.open ?? false) },
    h("summary", { class: "hm-disclosure-summary" }, () => props.title),
    h("div", { class: "hm-disclosure-body" }, () => props.children)) as HTMLDetailsElement;
  el.addEventListener("toggle", () => props.onToggle?.(el.open));
  return el;
}
