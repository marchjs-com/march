// Segmented: a compact single choice of joined buttons; arrow keys move and select.
import "./segmented.css";
import { h } from "../../../dom/h.ts";
import { roving } from "../../../ui/focus.ts";
import { model, ctl, cx, normOptions, same, labelledBy, useField, type ControlProps, type OptionsProp } from "../../../forms/util.ts";
import { colorAttr } from "../../../theme/colors.ts";

export interface SegmentedProps<T = unknown> extends ControlProps<T | null> {
  options?: OptionsProp;
}

/** Segmented control (a compact single choice). Arrow keys move and select. */
export function Segmented<T = unknown>(props: SegmentedProps<T>): unknown {
  const [get, set] = model<T | null>(props, null);
  const field = useField();
  const baseId = props.id ?? field?.id;
  const c = ctl(props);
  let root: Element;
  const onKeyDown = (e: KeyboardEvent) => { const target = roving(e, [...root.querySelectorAll("button")].filter((b) => !b.disabled), { horizontal: true }); if (target) target.click(); };
  root = h("div", { "data-hm-color": colorAttr(props.color), role: "radiogroup", class: cx("hm-segmented", props.class), "aria-labelledby": labelledBy(props), "aria-label": c["aria-label"], "aria-invalid": c["aria-invalid"], onKeyDown },
    () => {
      const opts = normOptions(props.options);
      return opts.map((o, i) => h("button", {
        type: "button", role: "radio", class: "hm-segment", id: i === 0 ? baseId : undefined, onBlur: props.onBlur,
        "aria-checked": () => String(same(get(), o.value)),
        tabindex: () => (same(get(), o.value) || (i === 0 && !opts.some((x) => same(x.value, get()))) ? "0" : "-1"),
        disabled: () => !!(props.disabled || props.readonly || o.disabled), onClick: () => set(o.value as T),
      }, o.label));
    });
  return root;
}
