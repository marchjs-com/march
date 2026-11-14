// TimeInput: the native time field; value "HH:MM".
import "./time-input.css";
import "../../../ui/field.css";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, syncValue, type ControlProps } from "../../../forms/util.ts";

export interface TimeInputProps extends ControlProps<string> {
  min?: string | null | undefined;
  max?: string | null | undefined;
  /** Seconds. */
  step?: number | null | undefined;
}

/** Native time input; value "HH:MM". Props: min, max, step (seconds). */
export function TimeInput(props: TimeInputProps): unknown {
  const [get, set] = model(props, "");
  const el = h("input", {
    ...ctl(props), type: "time", class: cx("m-input m-time", props.class), min: () => props.min ?? null, max: () => props.max ?? null,
    step: () => props.step ?? null, readonly: () => !!props.readonly, onInput: (e: Event) => set((e.target as HTMLInputElement).value),
  }) as HTMLInputElement;
  syncValue(el, get);
  return el;
}
