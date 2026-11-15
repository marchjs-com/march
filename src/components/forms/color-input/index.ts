// ColorInput: the native swatch picker plus a #RRGGBB text field.
import "./color-input.css";
import "../../../ui/field.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { model, ctl, cx, syncValue, extend, type ControlProps } from "../../../forms/util.ts";
import { inputOf } from "../../../forms/affix.ts";
import { Swatch } from "../swatch/index.ts";
import { TextInput, type TextInputProps } from "../text-input/index.ts";

export interface ColorInputProps extends ControlProps<string> {
  /** The native swatch picker: `false` leaves only the text field. @tr Tarayıcının renk seçicisi: `false` yalnız metin alanını bırakır. */
  swatch?: boolean | undefined;
  /** The #RRGGBB text field: `false` leaves only the swatch. @tr #RRGGBB metin alanı: `false` yalnız renk kutusunu bırakır. */
  text?: boolean | undefined;
  /** Accessible name of the swatch (default "Pick a color"). @tr Renk kutusunun erişilebilir adı (varsayılan "Pick a color"). */
  swatchLabel?: string | undefined;
  /** Placeholder of the text field (default "#RRGGBB"). @tr Metin alanının yer tutucusu (varsayılan "#RRGGBB"). */
  placeholder?: string | undefined;
}

/** Color: native swatch picker plus a #RRGGBB text field. */
export function ColorInput(props: ColorInputProps): unknown {
  const [get, set] = model(props, "");
  const both = props.swatch !== false && props.text !== false;
  // with the text field off, the swatch is the control (id, name, aria wiring)
  const swatch = h("input", { ...(props.text === false ? ctl(props) : {}), type: "color", class: "m-color-swatch", "aria-label": () => props.swatchLabel ?? props["aria-label"] ?? props.ariaLabel ?? t`Pick a color`, disabled: () => !!(props.disabled || props.readonly), onInput: (e: Event) => set(inputOf(e).value.toLowerCase()) }) as HTMLInputElement;
  const hex = () => (/^#[0-9a-f]{6}$/i.test(get() ?? "") ? get().toLowerCase() : "#000000");
  syncValue(swatch, hex);
  // the colour is drawn by a Swatch; the native picker lies over it, invisible, and takes the click and the keyboard
  const sample = () => h(Swatch, { class: "m-color-sample", color: hex, checker: false }, swatch);
  // the text field is a TextInput bound to the same value (called directly: the live props stay getters)
  const text = () => TextInput(extend(props as TextInputProps, {
    class: () => "m-color-text", value: get, setValue: () => set, onChange: () => undefined, maxLength: () => 7, spellcheck: () => "false", autocomplete: () => "off",
    placeholder: () => props.placeholder ?? "#RRGGBB", transform: () => (v: string) => v.trim().toLowerCase(),
  }));
  return h("span", { class: () => cx("m-color", props.class) }, both || props.text === false ? sample() : null, both || props.swatch === false ? text() : null);
}
