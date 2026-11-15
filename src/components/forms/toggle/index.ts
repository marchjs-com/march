// Toggle: an on / off switch (role="switch").
import "./toggle.css";
import { untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, type ControlProps } from "../../../forms/util.ts";

export interface ToggleProps extends ControlProps<boolean | null> {
  label?: unknown;
  /**
   * Three states: on, off and "not set" (null, the thumb in the middle): for a prop where unset differs from false
   * (a toggle button's `pressed`). A click goes not set → on → off → not set. Default false (two states).
   */
  tristate?: boolean | undefined;
  children?: unknown;
}

/** On / off switch (role="switch"); `tristate`: on / off / not set (role="checkbox", aria-checked="mixed" when not set). */
export function Toggle(props: ToggleProps): unknown {
  const tri = !!props.tristate;
  const [get, set] = model<boolean | null>(props, tri ? null : false);
  const next = (v: boolean | null): boolean | null => (!tri ? !v : v == null ? true : v ? false : null);
  const btn = h("button", {
    ...ctl(props), type: "button", role: tri ? "checkbox" : "switch", class: cx("m-switch", tri && "m-switch-tri"),
    "aria-checked": () => { const v = get(); return tri && v == null ? "mixed" : String(!!v); },
    disabled: () => !!(props.disabled || props.readonly), onClick: () => set(next(untrack(get))),
  }, h("span", { class: "m-switch-thumb", "aria-hidden": "true" }));
  const label = () => props.label ?? props.children;
  return h("label", { class: cx("m-switch-wrap", props.class) }, btn, () => (label() != null ? h("span", { class: "m-check-label" }, label()) : null));
}
