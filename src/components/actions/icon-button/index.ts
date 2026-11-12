// IconButton (hadi-march/ui): an icon-only button with a required accessible name. Folder: src/components/actions/icon-button/.
import "./icon-button.css";
import { h } from "../../../dom/h.ts";
import { val, cx, rest, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { buttonSizeClass, type ButtonSize } from "../button/index.ts";

/** Props of <IconButton>. `label` (or aria-label) is required. */
export interface IconButtonProps {
  icon?: unknown;
  label?: MaybeFn<string>;
  "aria-label"?: MaybeFn<string>;
  variant?: string | undefined;
  size?: MaybeFn<ButtonSize | undefined>;
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}
/** Icon-only button. `label` is required (aria-label + tooltip title). `<IconButton icon="✕" label="Close" onClick={…}/>` */
export function IconButton(props: IconButtonProps): Element {
  if (props.label == null && props["aria-label"] == null) throw new Error("March: <IconButton> needs a label (accessible name).");
  const attrs = rest(props, ["icon", "label", "variant", "size"]);
  return h("button", {
    type: "button", ...attrs, class: () => cx("hm-icon-btn", props.variant && `hm-icon-btn-${props.variant}`, buttonSizeClass(val(props.size)), val(props.class)),
    "aria-label": () => val(props.label) ?? val(props["aria-label"]), title: () => val(props.label),
  }, icon(val(props.icon)) ?? props.children);
}
