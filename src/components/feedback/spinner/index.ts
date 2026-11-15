// Spinner (march/feedback): a ring that turns while something loads; one colour or the theme's several.
import "./spinner.css";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { spinnerRing } from "./core.ts";
import { colorAttr, colorList, tokenColor, type ColorToken, type MultiColors } from "../../../theme/colors.ts";

export interface SpinnerProps {
  /** "sm" | "md" | "lg", or "em": the size and the colour of the text around it (inside a button, a line of text). @tr "sm" | "md" | "lg" ya da "em": çevresindeki metnin boyutu ve rengi (bir düğmenin, bir metin satırının içinde). */
  size?: "sm" | "md" | "lg" | "em";
  /** The accessible name (default "Loading", translated). @tr Erişilebilir ad (varsayılan "Loading", çevrilir). */
  label?: MaybeFn<string | undefined>;
  /** Extra classes on the spinner. @tr Dönen göstergeye eklenen sınıflar. */
  class?: ClassProp;
  /** Hidden from assistive technology: no role, no label (a text or a live region next to it already says it). @tr Yardımcı teknolojiden gizli: rol yok, etiket yok (yanındaki metin ya da canlı bölge zaten söylüyor). */
  decorative?: boolean | undefined;
  /** "brand", a list of color tokens, or "single" (one color in a multicolor theme). @tr "brand", renk belirteçleri listesi ya da "single" (çok renkli temada tek renk). */
  colors?: MultiColors | undefined;
  /** One theme color token ("brand-orange", "success"…): a one-colour ring in that colour. @tr Tek bir tema renk belirteci ("brand-orange", "success"…): o renkte tek renkli halka. */
  color?: ColorToken | undefined;
}
/** `<Spinner size="sm" label="Loading users" />`, `<Spinner decorative size="em" />` (inside a control that names the state itself). */
export function Spinner(props: SpinnerProps): Element {
  const el = spinnerRing(() => props.size, () => cx((props.colors === "single" || (props.color && !colorList(props.colors))) && "m-spin-single", val(props.class)), { "data-m-color": () => colorAttr(props.color), ...(props.decorative ? { "aria-hidden": "true" } : { role: "status", "aria-label": () => val(props.label) ?? t`Loading` }) });
  const list = colorList(props.colors);
  if (list) { el.setAttribute("data-m-colors", Array.isArray(props.colors) ? "custom" : String(props.colors)); el.style.setProperty("--m-spinner-paint", `conic-gradient(from 0deg, transparent 0 8%, ${list.map(tokenColor).join(", ")})`); el.style.setProperty("--m-spinner-track", "transparent"); el.style.setProperty("--m-spinner-head", "transparent"); }
  return el;
}
