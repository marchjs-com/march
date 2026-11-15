// CheckboxGroup: several checkboxes; the value is the array of checked option values.
import "./checkbox-group.css";
import { untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { model, ctl, uid, normOptions, same, labelledBy, useField, type ControlProps, type OptionsProp } from "../../../forms/util.ts";
import { inputOf } from "../../../forms/affix.ts";
import { colorAttr } from "../../../theme/colors.ts";
import { choiceBox, choiceText, itemColor, groupClass, type ChoiceGroupLook } from "../../../forms/choice.ts";
export type { ChoiceGroupLook };

export interface CheckboxGroupProps<T = unknown> extends ControlProps<T[]>, ChoiceGroupLook {
  /** [{ value, label, hint?, icon?, meta?, disabled? }] (icon, hint and meta — a price or badge — show in the card variant). @tr [{ value, label, hint?, icon?, meta?, disabled? }] (icon, hint ve meta — fiyat ya da rozet — card görünümünde görünür). */
  options?: OptionsProp;
  /** Lays the options out in a row instead of a column. @tr Seçenekleri sütun yerine yan yana dizer. */
  inline?: boolean | undefined;
}

/** Several checkboxes; value is an array of the checked option values. Props: options, inline, variant, colors… */
export function CheckboxGroup<T = unknown>(props: CheckboxGroupProps<T>): unknown {
  const [get, set] = model<T[]>(props, []);
  const field = useField();
  const baseId = props.id ?? field?.id ?? uid("m-cbg");
  const c = ctl(props);
  return h("div", { role: "group", class: () => groupClass(props, "checkbox"), "aria-labelledby": labelledBy(props), "aria-describedby": c["aria-describedby"], "aria-invalid": c["aria-invalid"] },
    () => normOptions(props.options).map((o, i) => h("label", { class: "m-check", "data-m-color": () => itemColor(props.colors, i) },
      h("input", {
        type: "checkbox", class: "m-check-input", id: i ? `${baseId}-${i}` : baseId, name: props.name, onBlur: props.onBlur,
        checked: () => (get() ?? []).some((x) => same(x, o.value)), disabled: () => !!(props.disabled || props.readonly || o.disabled),
        onChange: (e: Event) => { const cur = (untrack(get) ?? []).filter((x) => !same(x, o.value)); set(inputOf(e).checked ? [...cur, o.value as T] : cur); },
      }),
      choiceBox("checkbox", props),
      choiceText(o.label, o.hint, o["icon"], props.variant, o["meta"]))));
}
