// IconButton (march/ui): an icon-only button with a required accessible name. Folder: src/components/actions/icon-button/.
import "./icon-button.css";
import { h } from "../../../dom/h.ts";
import { val, cx, rest, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { buttonSizeClass, buttonLink, pressedAttr, type ButtonHref, type ButtonSize } from "../button/index.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import type { IconProp } from "../../../icons/types.ts";

export type IconButtonSize = "xs" | ButtonSize;
/** `danger`: red icon. `solid`: filled with the accent (`color`, default the theme's primary). `raised`: surface, border and shadow (floating buttons). */
export type IconButtonVariant = "danger" | "solid" | "raised";

/** Props of <IconButton>. `label` (or aria-label) is required. */
export interface IconButtonProps {
  /** The icon (an icon or a node). @tr İkon (ikon ya da düğüm). */
  icon?: IconProp;
  /** Accessible name and tooltip (required, or `aria-label`). @tr Erişilebilir ad ve ipucu (zorunlu, ya da `aria-label`). */
  label?: MaybeFn<string>;
  /** The name when no `label` is given (no tooltip then). @tr `label` verilmediğinde ad (o zaman ipucu çıkmaz). */
  "aria-label"?: MaybeFn<string>;
  /** The native tooltip: the label by default, your own text, or false for none. @tr Yerel ipucu: varsayılan etiket, kendi metnin ya da hiç olmaması için false. */
  title?: MaybeFn<string | undefined> | false;
  /** danger (red icon), solid (filled with the accent) or raised (surface, border and shadow); unset: plain. @tr danger (kırmızı ikon), solid (vurgu rengiyle dolu) ya da raised (yüzey, kenarlık ve gölge); boşsa düz. */
  variant?: MaybeFn<IconButtonVariant | (string & {}) | undefined>;
  /** xs, sm, md (default) or lg. @tr xs, sm, md (varsayılan) ya da lg. */
  size?: MaybeFn<IconButtonSize | undefined>;
  /** `round`: a circle. @tr `round`: daire. */
  shape?: MaybeFn<"round" | undefined>;
  /** A toggle button: sets `aria-pressed` and the shared pressed look (`is-pressed`). Leave unset for a plain button. @tr Aç / kapa düğmesi: `aria-pressed` ve ortak basılı görünüm (`is-pressed`). Düz düğme için boş bırak. */
  pressed?: MaybeFn<boolean | null | undefined>;
  /** On dark media (a photo, a video, a scrim): light icon, light hover and focus ring. @tr Koyu medya üzerinde (fotoğraf, video, örtü): açık ikon, açık üzerine gelme ve odak halkası. */
  inverse?: MaybeFn<boolean | null | undefined>;
  /** Renders a link that looks like the button: the router's Link inside the app, a plain `<a>` for an external address. @tr Düğmeye benzeyen bir bağlantı çizer: uygulama içinde yönlendiricinin Link'i, dış adres için düz `<a>`. */
  href?: MaybeFn<ButtonHref>;
  /** Extra classes on the button. @tr Düğmeye eklenen sınıflar. */
  class?: ClassProp;
  /** Shown after the icon (alone when there is no icon): e.g. a count Badge, which sits on the corner. @tr İkondan sonra gösterilir (ikon yoksa tek başına): ör. köşeye oturan bir sayı Badge'i. */
  children?: unknown;
  [attr: string]: unknown;
}
/**
 * Icon-only button. `label` is required (aria-label + tooltip title). `<IconButton icon="✕" label="Close" onClick={…}/>`
 * size: xs | sm | md | lg. variant: danger | solid | raised. `shape="round"`, `pressed` (toggle), `inverse` (on dark media), `href` (a link).
 */
export function IconButton(props: IconButtonProps): Element {
  if (props.label == null && props["aria-label"] == null) throw new Error("March: <IconButton> needs a label (accessible name).");
  const size = (): string | undefined => { const s = val(props.size); return s === "xs" ? "m-btn-xs" : buttonSizeClass(s); };
  const variant = (): string | false => { const v = val(props.variant); return !!v && `m-icon-btn-${v}`; };
  const attrs = {
    ...rest(props, ["icon", "label", "variant", "size", "shape", "pressed", "inverse", "href", "title", "color"]),
    class: () => cx("m-icon-btn", variant(), size(), val(props.shape) === "round" && "m-icon-btn-round", val(props.inverse) && "m-icon-btn-inverse", val(props.pressed) && "is-pressed", val(props.class)),
    "aria-label": () => val(props.label) ?? val(props["aria-label"]), title: () => (props.title === false ? null : val(props.title) ?? val(props.label)),
    };
  const body = [() => icon(val(props.icon)), props.children];
  if (props.href != null) return buttonLink(attrs, props.href as MaybeFn<ButtonHref>, body) as Element;
  // without `pressed`, an aria-pressed passed by the caller stays as it is
  return h("button", { type: "button", ...attrs, ...("pressed" in props ? { "aria-pressed": () => pressedAttr(props.pressed) } : null) }, body);
}
