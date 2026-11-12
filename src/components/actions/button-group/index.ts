// ButtonGroup (hadi-march/ui): related buttons side by side, spaced or attached. Folder: src/components/actions/button-group/.
import "./button-group.css";
import "../button/button.css";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

export interface ButtonGroupProps { label?: MaybeFn<string>; attached?: boolean; class?: ClassProp; children?: unknown }
/** Group related buttons: `<ButtonGroup label="View">…</ButtonGroup>` */
export function ButtonGroup(props: ButtonGroupProps): Element {
  return h("div", { class: () => cx("hm-btn-group", props.attached && "hm-btn-group-attached", val(props.class)), role: "group", "aria-label": () => val(props.label) ?? null }, props.children);
}
