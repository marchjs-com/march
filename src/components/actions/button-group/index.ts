// ButtonGroup (hadi-march/ui): related buttons side by side, spaced or attached. Folder: src/components/actions/button-group/.
import "./button-group.css";
import "../button/button.css";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

export interface ButtonGroupProps {
  /** Accessible name of the group. @tr Grubun erişilebilir adı. */
  label?: MaybeFn<string>;
  /** One strip without gaps (default false). @tr Boşluksuz tek şerit (varsayılan false). */
  attached?: boolean;
  /** Extra classes on the group. @tr Gruba eklenen sınıflar. */
  class?: ClassProp;
  /** The buttons. @tr Düğmeler. */
  children?: unknown;
}
/** Group related buttons: `<ButtonGroup label="View">…</ButtonGroup>` */
export function ButtonGroup(props: ButtonGroupProps): Element {
  return h("div", { class: () => cx("m-btn-group", props.attached && "m-btn-group-attached", val(props.class)), role: "group", "aria-label": () => val(props.label) ?? null }, props.children);
}
