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
    ...ctl(props), type: "button", role: "switch", class: "hm-switch", "aria-checked": () => String(!!get()),
    disabled: () => !!(props.disabled || props.readonly), onClick: () => set(!untrack(get)),
  }, h("span", { class: "hm-switch-thumb", "aria-hidden": "true" }));
  const label = () => props.label ?? props.children;
  return h("label", { class: cx("hm-switch-wrap", props.class) }, btn, () => (label() != null ? h("span", { class: "hm-check-label" }, label()) : null));
}
