// Slider: a range input with its value shown next to it.
import "./slider.css";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, syncValue, type ControlProps } from "../../../forms/util.ts";
import { inputOf } from "../../../forms/affix.ts";
import { colorAttr } from "../../../theme/colors.ts";

export interface SliderProps extends ControlProps<number> {
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  /** Text of the value shown next to the slider. */
  format?: ((v: number) => unknown) | undefined;
  /** The value shown next to the slider: `false` removes it. */
  showValue?: boolean | undefined;
  /**
   * Your own track under a drawn thumb, instead of the browser's: `true` (a ramp in the control's color), a class name
   * (the track is yours: a gradient from your CSS) or a node drawn as the track. Thumb fill: `--m-slider-thumb`.
   */
  track?: unknown;
  /** Spoken value (`aria-valuetext`), e.g. `(v) => v + " degrees"`. */
  valueText?: ((v: number) => string) | undefined;
  /** Called once when a change is finished (pointer released, key pressed), after `onChange`. */
  onCommit?: ((v: number) => void) | undefined;
}

/** Range slider with the current value shown. Props: min, max, step, format(v), track (your own track). */
export function Slider(props: SliderProps): unknown {
  const [get, set] = model(props, props.min ?? 0);
  const track = props.track != null && props.track !== false ? props.track : null;
  const el = h("input", {
    ...ctl(props), type: "range", class: cx("m-slider", track != null && "m-slider-own"), min: () => props.min ?? 0, max: () => props.max ?? 100, step: () => props.step ?? 1,
    "aria-valuetext": () => (props.valueText ? props.valueText(get()) : null),
    disabled: () => !!(props.disabled || props.readonly), onInput: (e: Event) => set(Number(inputOf(e).value)),
    onChange: (e: Event) => props.onCommit?.(Number(inputOf(e).value)),
  }) as HTMLInputElement;
  syncValue(el, get);
  const rail = track == null ? el : h("span", { class: "m-slider-rail" },
    h("span", { class: cx("m-slider-track", track === true ? "m-slider-ramp" : typeof track === "string" && track), "aria-hidden": "true" }, track === true || typeof track === "string" ? null : track), el);
  return h("span", { class: () => cx("m-slider-wrap", props.class) }, rail, props.showValue === false ? null : h("output", { class: "m-slider-value", for: () => el.id || null }, () => (props.format ? props.format(get()) : String(get() ?? ""))));
}
