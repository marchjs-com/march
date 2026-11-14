// Spinner (hadi-march/feedback): a ring that turns while something loads; one colour or the theme's several.
import "./spinner.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, colorList, tokenColor, type ColorToken, type MultiColors } from "../../../theme/colors.ts";

export interface SpinnerProps {
  /** "sm" | "md" | "lg", or "em": the size and the colour of the text around it (inside a button, a line of text). */
  size?: "sm" | "md" | "lg" | "em"; label?: MaybeFn<string | undefined>; class?: ClassProp;
  /** Hidden from assistive technology: no role, no label (a text or a live region next to it already says it). */
  decorative?: boolean | undefined;
  /** "brand", a list of color tokens, or "single" (one color in a multicolor theme). */
  colors?: MultiColors | undefined;
  /** One theme color token ("brand-orange", "success"…): a one-colour ring in that colour. */
  color?: ColorToken | undefined;
}
/** `<Spinner size="sm" label="Loading users" />`, `<Spinner decorative size="em" />` (inside a control that names the state itself). */
export function Spinner(props: SpinnerProps): Element {
  const el = h("span", { class: () => cx("hm-loading", props.size && `hm-spin-${props.size}`, (props.colors === "single" || (props.color && !colorList(props.colors))) && "hm-spin-single", val(props.class)), "data-hm-color": () => colorAttr(props.color), ...(props.decorative ? { "aria-hidden": "true" } : { role: "status", "aria-label": () => val(props.label) ?? t`Loading` }) }) as HTMLElement;
  const list = colorList(props.colors);
  if (list) { el.setAttribute("data-hm-colors", Array.isArray(props.colors) ? "custom" : String(props.colors)); el.style.setProperty("--hm-spinner-paint", `conic-gradient(from 0deg, transparent 0 8%, ${list.map(tokenColor).join(", ")})`); el.style.setProperty("--hm-spinner-track", "transparent"); el.style.setProperty("--hm-spinner-head", "transparent"); }
  return el;
}
