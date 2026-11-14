// Kbd (hadi-march/ui). Folder: src/components/typography/kbd/.
import "./kbd.css";
import { h } from "../../../dom/h.ts";
import { formatKey } from "../../../ui/keys.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

export interface KbdProps { keys?: MaybeFn<string>; class?: ClassProp; children?: unknown }
/** Keyboard key(s): `<Kbd>Esc</Kbd>`, `<Kbd keys="mod+k" />` → Ctrl+K / ⌘K. */
export function Kbd(props: KbdProps): Element {
  const cls = (): string => cx("m-kbd", val(props.class));
  if (props.keys) return h("kbd", { class: cls }, () => formatKey(val(props.keys ?? "")));
  return h("kbd", { class: cls }, props.children);
}
