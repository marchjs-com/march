// TextInput (with EmailInput and UrlInput): single-line text that works standalone or inside a <Field>/<Form>.
import "./text-input.css";
import "../../../ui/field.css";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, extend, syncValue, type ControlProps } from "../../../forms/util.ts";
import { affix, textAttrs, inputOf, type AffixProps, type TextAttrProps } from "../../../forms/affix.ts";
export { affix, type AffixProps, type TextAttrProps };

export interface TextInputProps extends ControlProps<string>, TextAttrProps, AffixProps {
  type?: string | undefined;
  transform?: ((v: string) => string) | undefined;
  onKeyDown?: ((e: KeyboardEvent) => void) | undefined;
  ref?: ((el: HTMLInputElement) => void) | undefined;
}

/** Single-line text. Props: type, placeholder, readonly, autocomplete, inputmode, maxLength, prefix, suffix, transform(v). */
export function TextInput(props: TextInputProps): unknown {
  const [get, set] = model(props, "");
  const el = h("input", {
    ...ctl(props), ...textAttrs(props), type: props.type ?? "text", class: cx("hm-input", props.prefix == null && props.suffix == null && props.class),
    onInput: (e: Event) => set(props.transform ? props.transform(inputOf(e).value) : inputOf(e).value),
    onKeyDown: props.onKeyDown,
  }) as HTMLInputElement;
  syncValue(el, get);
  props.ref?.(el);
  return affix(props, el);
}

/** Text input for an e-mail address (email keyboard, trimmed, lower-cased). */
export const EmailInput = (props: TextInputProps): unknown => TextInput(extend(props, { type: () => "email", autocomplete: () => props.autocomplete ?? "email", inputmode: () => "email", transform: () => (v) => v.trim() }));
/** Text input for a web address (url keyboard, https:// placeholder). */
export const UrlInput = (props: TextInputProps): unknown => TextInput(extend(props, { type: () => "url", inputmode: () => "url", placeholder: () => props.placeholder ?? "https://", transform: () => (v) => v.trim() }));
