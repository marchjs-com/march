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
  /** The click on the input, with its modifier keys (`e.shiftKey` for a range selection in a list or a grid). */
  onClick?: ((e: MouseEvent) => void) | undefined;
  /** Tab order of the input (`-1` inside a grid that moves focus with the arrow keys). */
  tabIndex?: number | undefined;
}

/**
 * Checkbox with its label (`label` prop or children): a drawn box (animated tick), the real input stays for keyboard,
 * forms and screen readers. `variant="classic" | "soft" | "chip" | "card" | "toggle"`, `size`, `shape`, `icon`, `color`.
 * Without a label (a table or grid cell) only the box is drawn: name it with `aria-label`.
 */
export function Checkbox(props: CheckboxProps): unknown {
  const [get, set] = model(props, false);
  const input = h("input", {
    ...ctl(props), type: "checkbox", class: "hm-check-input", checked: () => !!get(), indeterminate: () => !!props.indeterminate,
    // after a change the box shows the model again (a controlled value may not have followed the click)
    disabled: () => !!(props.disabled || props.readonly), onChange: (e: Event) => { const box = inputOf(e); set(box.checked); box.checked = !!get(); },
    onClick: props.onClick, tabindex: props.tabIndex ?? null,
  });
  // no label, no hint: the box alone (a selection cell)
  const bare = props.label == null && props.children == null && props.hint == null;
  return h("span", { class: () => cx(lookClass(props, "checkbox"), "hm-choice-single", bare && "hm-choice-bare", typeof props.class === "function" ? (props.class as () => unknown)() : props.class), "data-hm-color": () => colorAttr(props.color) },
    h("label", { class: "hm-check" }, input, choiceBox("checkbox", props), bare ? null : choiceText(() => props.label ?? props.children, props.hint, props.icon && props.variant === "card" ? props.icon : null, props.variant)));
}
