// Toggle: an on / off switch (role="switch").
import "./toggle.css";
import { untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, type ControlProps } from "../../../forms/util.ts";

export interface ToggleProps extends ControlProps<boolean> {
  label?: unknown;
  children?: unknown;
}

/** On / off switch (role="switch"). */
export function Toggle(props: ToggleProps): unknown {
  const [get, set] = model(props, false);
  const btn = h("button", {
    ...ctl(props), type: "button", role: "switch", class: "m-switch", "aria-checked": () => String(!!get()),
    disabled: () => !!(props.disabled || props.readonly), onClick: () => set(!untrack(get)),
  }, h("span", { class: "m-switch-thumb", "aria-hidden": "true" }));
  const label = () => props.label ?? props.children;
  return h("label", { class: cx("m-switch-wrap", props.class) }, btn, () => (label() != null ? h("span", { class: "m-check-label" }, label()) : null));
}
