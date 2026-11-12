// Kbd (hadi-march/ui). Folder: src/components/typography/kbd/.
import "./kbd.css";
import { h } from "../../../dom/h.ts";
import { formatKey } from "../../../ui/keys.ts";
import { val, type MaybeFn } from "../../../ui/util.ts";

export interface KbdProps { keys?: MaybeFn<string>; children?: unknown }
/** Keyboard key(s): `<Kbd>Esc</Kbd>`, `<Kbd keys="mod+k" />` → Ctrl+K / ⌘K. */
export function Kbd(props: KbdProps): Element {
  if (props.keys) return h("kbd", { class: "hm-kbd" }, () => formatKey(val(props.keys ?? "")));
  return h("kbd", { class: "hm-kbd" }, props.children);
}
