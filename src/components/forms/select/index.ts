// Select: the native drop-down; option values keep their type.
import "./select.css";
import "../../../ui/field.css";
import { computed, effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, normOptions, same, type ControlProps, type OptionsProp } from "../../../forms/util.ts";
import { locked } from "../../../ui/behave.ts";

export interface SelectProps<T = unknown> extends ControlProps<T | null> {
  /** [value] or [{ value, label, disabled }]; may be live. A text is a comma-separated list ("Tea, Coffee"). @tr [value] ya da [{ value, label, disabled }]; canlı olabilir. Metin virgülle ayrılmış bir listedir ("Çay, Kahve"). */
  options?: OptionsProp;
  /** Text of the empty first option; false: no empty option (a choice that is never empty, e.g. a language). @tr Boş ilk seçeneğin metni; false: boş seçenek yok (hiç boş kalmayan bir seçim, ör. dil). */
  placeholder?: string | false | undefined;
}

/** Native select. Props: options ([value] or [{value,label,disabled}], may be live, or a comma-separated text), placeholder. Values keep their type. */
export function Select<T = unknown>(props: SelectProps<T>): unknown {
  const [get, set] = model<T | null>(props, null);
  const opts = computed(() => normOptions(props.options));
  const el = h("select", {
    ...ctl(props), class: cx("m-select m-select-field", props.class), disabled: () => locked(props),
    onChange: (e: Event) => { const i = (e.target as HTMLSelectElement).value; set(i === "" ? null : (opts()[+i]?.value as T | undefined) ?? null); },
  }, () => [props.placeholder === false ? null : h("option", { value: "" }, props.placeholder ?? ""), ...opts().map((o, i) => h("option", { value: String(i), disabled: !!o.disabled }, o.label))]) as HTMLSelectElement;
  effect(() => { const i = opts().findIndex((o) => same(o.value, get())); el.value = i < 0 ? "" : String(i); });
  return el;
}
