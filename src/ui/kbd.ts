// Kbd. (hadi-march/ui; split from display.ts so each component is its own module and chunk).
import "./display.css";
import { h } from "../dom/h.ts";
import { formatKey } from "./keys.ts";
import { val, type MaybeFn } from "./util.ts";

export interface KbdProps { keys?: MaybeFn<string>; children?: unknown }
/** Keyboard key(s): `<Kbd>Esc</Kbd>`, `<Kbd keys="mod+k" />` → Ctrl+K / ⌘K. */
export function Kbd(props: KbdProps): Element {
  if (props.keys) return h("kbd", { class: "hm-kbd" }, () => formatKey(val(props.keys ?? "")));
  return h("kbd", { class: "hm-kbd" }, props.children);
}
