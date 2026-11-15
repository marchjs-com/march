// RadioGroup: radio buttons; the value is the chosen option value.
import "./radio-group.css";
import { h } from "../../../dom/h.ts";
import { model, ctl, uid, normOptions, same, labelledBy, useField, type ControlProps, type OptionsProp } from "../../../forms/util.ts";
import { inputOf } from "../../../forms/affix.ts";
import { colorAttr } from "../../../theme/colors.ts";
import { choiceBox, choiceText, itemColor, groupClass, type ChoiceGroupLook } from "../../../forms/choice.ts";

export interface RadioGroupProps<T = unknown> extends ControlProps<T | null>, ChoiceGroupLook {
  /** The choices: `[value]` or `[{ value, label, hint?, icon?, meta?, disabled? }]`. @tr Seçenekler: `[value]` ya da `[{ value, label, hint?, icon?, meta?, disabled? }]`. */
  options?: OptionsProp;
  /** Lays the options out in a row instead of a column. @tr Seçenekleri sütun yerine yan yana dizer. */
  inline?: boolean | undefined;
}

/** Radio buttons; value is the chosen option value. Props: options, inline, variant ("segmented" too), colors… */
export function RadioGroup<T = unknown>(props: RadioGroupProps<T>): unknown {
  const [get, set] = model<T | null>(props, null);
  const field = useField();
  const baseId = props.id ?? field?.id ?? uid("m-rg");
  const name = props.name ?? baseId;
  const c = ctl(props);
  return h("div", { role: "radiogroup", class: () => groupClass(props, "radio"), "aria-labelledby": labelledBy(props), "aria-describedby": c["aria-describedby"], "aria-invalid": c["aria-invalid"] },
    () => normOptions(props.options).map((o, i) => h("label", { class: "m-check", "data-m-color": () => itemColor(props.colors, i) },
      h("input", {
        type: "radio", class: "m-check-input", id: i ? `${baseId}-${i}` : baseId, name, onBlur: props.onBlur,
        checked: () => same(get(), o.value), disabled: () => !!(props.disabled || props.readonly || o.disabled),
        onChange: (e: Event) => { if (inputOf(e).checked) set(o.value as T); },
      }),
      choiceBox("radio", props),
      choiceText(o.label, o.hint, o["icon"], props.variant, o["meta"]))));
}
