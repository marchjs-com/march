// Textarea: multi-line text that grows with its content.
import "./textarea.css";
import "../../../ui/field.css";
import { effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, syncValue, type ControlProps } from "../../../forms/util.ts";
import { textAttrs, type TextAttrProps } from "../../../forms/affix.ts";

export interface TextareaProps extends ControlProps<string>, TextAttrProps {
  /** Starting height in lines (default 3). @tr Satır cinsinden başlangıç yüksekliği (varsayılan 3). */
  rows?: number | undefined;
  /** Grow with the content (default true). @tr İçerikle birlikte büyür (varsayılan true). */
  autosize?: boolean | undefined;
  /** Monospace text (code, JSON, logs). @tr Eş aralıklı yazı (kod, JSON, günlükler). */
  mono?: boolean | undefined;
  /** The Tab key indents instead of leaving the field: `true` (two spaces) or the number of spaces. Escape, then Tab, leaves. @tr Tab tuşu alandan çıkmak yerine girinti yapar: `true` (iki boşluk) ya da boşluk sayısı. Önce Escape, sonra Tab alandan çıkar. */
  tabIndent?: boolean | number | undefined;
  /** Key handler of the textarea. @tr Metin alanının tuş işleyicisi. */
  onKeyDown?: ((e: KeyboardEvent) => void) | undefined;
  /** Called with the textarea element. @tr Metin alanı öğesiyle çağrılır. */
  ref?: ((el: HTMLTextAreaElement) => void) | undefined;
}

/** Multi-line text that grows with its content (`autosize={false}` to disable). Props: rows, mono, tabIndent. */
export function Textarea(props: TextareaProps): unknown {
  const [get, set] = model(props, "");
  // Escape lets the next Tab leave a field that indents with Tab
  let leave = false;
  const onKeyDown = (e: KeyboardEvent): void => {
    props.onKeyDown?.(e);
    const n = props.tabIndent === true ? 2 : props.tabIndent || 0;
    if (e.key === "Tab" && n && !leave && !e.shiftKey && !e.defaultPrevented && !props.readonly) {
      e.preventDefault();
      const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
      el.value = el.value.slice(0, a) + " ".repeat(n) + el.value.slice(b);
      el.selectionStart = el.selectionEnd = a + n;
      set(el.value); fit();
    }
    leave = e.key === "Escape";
  };
  const el = h("textarea", { ...ctl(props), ...textAttrs(props), rows: props.rows ?? 3, class: cx("m-input m-textarea", props.mono && "m-mono", props.autosize !== false && "m-textarea-grow", props.class), onKeyDown, onInput: (e: Event) => { set((e.target as HTMLTextAreaElement).value); fit(); } }) as HTMLTextAreaElement;
  const fit = () => {
    if (props.autosize === false || !el.scrollHeight) return;
    el.style.setProperty("height", "auto");
    el.style.setProperty("height", `${el.scrollHeight + 2}px`);
  };
  syncValue(el, get);
  effect(() => { get(); fit(); });
  props.ref?.(el);
  return el;
}
