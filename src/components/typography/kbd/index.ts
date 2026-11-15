// Kbd (march/ui). Folder: src/components/typography/kbd/.
import "./kbd.css";
import { h } from "../../../dom/h.ts";
import { formatKey } from "../../../ui/keys.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

export interface KbdProps {
  /** A shortcut (`mod`, `shift`, `alt`, `ctrl` + key), written for the platform: "mod+k" → Ctrl+K / ⌘K. @tr Kısayol (`mod`, `shift`, `alt`, `ctrl` + tuş), platforma göre yazılır: "mod+k" → Ctrl+K / ⌘K. */
  keys?: MaybeFn<string>;
  /** Your own class next to `m-kbd`. @tr `m-kbd`'nin yanına kendi sınıfın. */
  class?: ClassProp;
  /** Plain key text when `keys` is not given. @tr `keys` verilmediğinde düz tuş metni. */
  children?: unknown;
}
/** Keyboard key(s): `<Kbd>Esc</Kbd>`, `<Kbd keys="mod+k" />` → Ctrl+K / ⌘K. */
export function Kbd(props: KbdProps): Element {
  const cls = (): string => cx("m-kbd", val(props.class));
  if (props.keys) return h("kbd", { class: cls }, () => formatKey(val(props.keys ?? "")));
  return h("kbd", { class: cls }, props.children);
}
