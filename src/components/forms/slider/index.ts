// Slider: a range input with its value shown next to it.
import "./slider.css";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, syncValue, type ControlProps } from "../../../forms/util.ts";
import { inputOf } from "../../../forms/affix.ts";

export interface SliderProps extends ControlProps<number> {
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  /** Text of the value shown next to the slider. */
  format?: ((v: number) => unknown) | undefined;
  /** The value shown next to the slider: `false` removes it. */
  showValue?: boolean | undefined;
}

/** Range slider with the current value shown. Props: min, max, step, format(v). */
export function Slider(props: SliderProps): unknown {
  const [get, set] = model(props, props.min ?? 0);
  const el = h("input", {
    ...ctl(props), type: "range", class: "hm-slider", min: () => props.min ?? 0, max: () => props.max ?? 100, step: () => props.step ?? 1,
    disabled: () => !!(props.disabled || props.readonly), onInput: (e: Event) => set(Number(inputOf(e).value)),
  }) as HTMLInputElement;
  syncValue(el, get);
  return h("span", { class: () => cx("hm-slider-wrap", props.class) }, el, props.showValue === false ? null : h("output", { class: "hm-slider-value", for: () => el.id || null }, () => (props.format ? props.format(get()) : String(get() ?? ""))));
}
