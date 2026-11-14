// ColorInput: the native swatch picker plus a #RRGGBB text field.
import "./color-input.css";
import "../../../ui/field.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { model, ctl, cx, syncValue, type ControlProps } from "../../../forms/util.ts";
import { inputOf } from "../../../forms/affix.ts";

export interface ColorInputProps extends ControlProps<string> {
  /** The native swatch picker: `false` leaves only the text field. */
  swatch?: boolean | undefined;
  /** The #RRGGBB text field: `false` leaves only the swatch. */
  text?: boolean | undefined;
  /** Accessible name of the swatch (default "Pick a color"). */
  swatchLabel?: string | undefined;
  /** Placeholder of the text field (default "#RRGGBB"). */
  placeholder?: string | undefined;
}

/** Color: native swatch picker plus a #RRGGBB text field. */
export function ColorInput(props: ColorInputProps): unknown {
  const [get, set] = model(props, "");
  const both = props.swatch !== false && props.text !== false;
  // with the text field off, the swatch is the control (id, name, aria wiring)
  const swatch = h("input", { ...(props.text === false ? ctl(props) : {}), type: "color", class: "hm-color-swatch", "aria-label": () => props.swatchLabel ?? props["aria-label"] ?? props.ariaLabel ?? t`Pick a color`, disabled: () => !!(props.disabled || props.readonly), onInput: (e: Event) => set(inputOf(e).value.toLowerCase()) }) as HTMLInputElement;
  syncValue(swatch, () => (/^#[0-9a-f]{6}$/i.test(get() ?? "") ? get().toLowerCase() : "#000000"));
  const text = h("input", { ...ctl(props), type: "text", class: "hm-input hm-color-text", maxlength: 7, spellcheck: "false", autocomplete: "off", placeholder: () => props.placeholder ?? "#RRGGBB", readonly: () => !!props.readonly, onInput: (e: Event) => set(inputOf(e).value.trim().toLowerCase()) }) as HTMLInputElement;
  syncValue(text, get);
  return h("span", { class: () => cx("hm-color", props.class) }, both || props.text === false ? swatch : null, both || props.swatch === false ? text : null);
}
