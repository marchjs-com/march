// Textarea: multi-line text that grows with its content.
import "./textarea.css";
import "../../../ui/field.css";
import { effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, syncValue, type ControlProps } from "../../../forms/util.ts";
import { textAttrs, type TextAttrProps } from "../../../forms/affix.ts";

export interface TextareaProps extends ControlProps<string>, TextAttrProps {
  rows?: number | undefined;
  /** Grow with the content (default true). */
  autosize?: boolean | undefined;
  ref?: ((el: HTMLTextAreaElement) => void) | undefined;
}

/** Multi-line text that grows with its content (`autosize={false}` to disable). Props: rows, maxRows. */
export function Textarea(props: TextareaProps): unknown {
  const [get, set] = model(props, "");
  const el = h("textarea", { ...ctl(props), ...textAttrs(props), rows: props.rows ?? 3, class: cx("hm-input hm-textarea", props.autosize !== false && "hm-textarea-grow", props.class), onInput: (e: Event) => { set((e.target as HTMLTextAreaElement).value); fit(); } }) as HTMLTextAreaElement;
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
