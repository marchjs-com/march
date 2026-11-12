// ColorInput: the native swatch picker plus a #RRGGBB text field.
import "./color-input.css";
import "../../../ui/field.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { model, ctl, cx, syncValue, type ControlProps } from "../../../forms/util.ts";
import { inputOf } from "../../../forms/affix.ts";

export interface ColorInputProps extends ControlProps<string> {}

/** Color: native swatch picker plus a #RRGGBB text field. */
export function ColorInput(props: ColorInputProps): unknown {
  const [get, set] = model(props, "");
  const swatch = h("input", { type: "color", class: "hm-color-swatch", "aria-label": t`Pick a color`, disabled: () => !!(props.disabled || props.readonly), onInput: (e: Event) => set(inputOf(e).value.toLowerCase()) }) as HTMLInputElement;
  syncValue(swatch, () => (/^#[0-9a-f]{6}$/i.test(get() ?? "") ? get().toLowerCase() : "#000000"));
  const text = h("input", { ...ctl(props), type: "text", class: "hm-input hm-color-text", maxlength: 7, spellcheck: "false", autocomplete: "off", placeholder: "#RRGGBB", readonly: () => !!props.readonly, onInput: (e: Event) => set(inputOf(e).value.trim().toLowerCase()) }) as HTMLInputElement;
  syncValue(text, get);
  return h("span", { class: cx("hm-color", props.class) }, swatch, text);
}
