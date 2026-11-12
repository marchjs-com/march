// Checkbox: one drawn checkbox with its label (classic, soft, chip, card, toggle looks).
import "./checkbox.css";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, type ControlProps } from "../../../forms/util.ts";
import { inputOf } from "../../../forms/affix.ts";
import { colorAttr } from "../../../theme/colors.ts";
import { choiceBox, choiceText, lookClass, type ChoiceLook } from "../../../forms/choice.ts";

export interface CheckboxProps extends ControlProps<boolean>, ChoiceLook {
  label?: unknown;
  children?: unknown;
  /** Smaller text under the label (in the card variant: the description). */
  hint?: unknown;
  indeterminate?: boolean | undefined;
}

/**
 * Checkbox with its label (`label` prop or children): a drawn box (animated tick), the real input stays for keyboard,
 * forms and screen readers. `variant="classic" | "soft" | "chip" | "card" | "toggle"`, `size`, `shape`, `icon`, `color`.
 */
export function Checkbox(props: CheckboxProps): unknown {
  const [get, set] = model(props, false);
  const input = h("input", {
    ...ctl(props), type: "checkbox", class: "hm-check-input", checked: () => !!get(), indeterminate: () => !!props.indeterminate,
    disabled: () => !!(props.disabled || props.readonly), onChange: (e: Event) => set(inputOf(e).checked),
  });
  return h("span", { class: () => cx(lookClass(props, "checkbox"), "hm-choice-single", typeof props.class === "function" ? (props.class as () => unknown)() : props.class), "data-hm-color": () => colorAttr(props.color) },
    h("label", { class: "hm-check" }, input, choiceBox("checkbox", props), choiceText(() => props.label ?? props.children, props.hint, props.icon && props.variant === "card" ? props.icon : null, props.variant)));
}
