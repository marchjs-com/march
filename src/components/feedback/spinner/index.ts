// Spinner (hadi-march/feedback): a ring that turns while something loads; one colour or the theme's several.
import "./spinner.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorList, tokenColor, type MultiColors } from "../../../theme/colors.ts";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg"; label?: MaybeFn<string | undefined>; class?: ClassProp;
  /** "brand", a list of color tokens, or "single" (one color in a multicolor theme). */
  colors?: MultiColors | undefined;
}
/** `<Spinner size="sm" label="Loading users" />` */
export function Spinner(props: SpinnerProps): Element {
  const el = h("span", { class: () => cx("hm-loading", props.size && `hm-spin-${props.size}`, props.colors === "single" && "hm-spin-single", val(props.class)), role: "status", "aria-label": () => val(props.label) ?? t`Loading` }) as HTMLElement;
  const list = colorList(props.colors);
  if (list) { el.setAttribute("data-hm-colors", Array.isArray(props.colors) ? "custom" : String(props.colors)); el.style.setProperty("--hm-spinner-paint", `conic-gradient(from 0deg, transparent 0 8%, ${list.map(tokenColor).join(", ")})`); el.style.setProperty("--hm-spinner-track", "transparent"); el.style.setProperty("--hm-spinner-head", "transparent"); }
  return el;
}
