// Swatch (march/forms): a sample of a colour or a gradient: the squares of a colour picker's palette, the
// presets of a gradient editor, the tones of a theme scale. `color` is any CSS colour or gradient (set through the
// CSSOM as a custom property, never a style string) or a theme token. With `onClick` it is a button that says whether
// it is selected; without it, a picture. Transparent colours show over a checkerboard: the one checkerboard of the
// library is the class in `CHECKER`, usable on any element (an alpha track, an image stage).
import "./swatch.css";
import { h } from "../../../dom/h.ts";
import { effect } from "../../../core/reactive.ts";
import { cx, val, rest, setStyle, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { COLOR_TOKENS } from "../../../theme/colors.ts";
import { check } from "../../../icons/glyphs/check.ts";

/** Class of the shared checkerboard background (shows through transparent colours): `class={CHECKER}`. Tune with `--m-checker-size`. */
export const CHECKER = "m-checker";

export interface SwatchProps {
  /** A CSS colour ("#ff7a1a", "oklch(…)", "rgb(0 0 0 / .4)"), a gradient ("linear-gradient(…)") or a theme token ("brand-blue"). @tr Bir CSS rengi ("#ff7a1a", "oklch(…)", "rgb(0 0 0 / .4)"), bir gradyan ("linear-gradient(…)") ya da bir tema token'ı ("brand-blue"). */
  color?: MaybeFn<string | null | undefined>;
  /** Selected: a ring around it; announced as pressed (or checked / selected with a matching `role`). @tr Seçili: çevresinde halka; basılı (ya da uygun `role` ile checked / selected) olarak duyurulur. */
  selected?: MaybeFn<boolean | undefined>;
  /** Accessible name ("Orange"); also the tooltip of a clickable swatch. @tr Erişilebilir ad ("Orange"); tıklanabilir renk kutusunun araç ipucu da olur. */
  label?: MaybeFn<string | null | undefined>;
  /** xs · sm · md (default) · lg. @tr xs · sm · md (varsayılan) · lg. */
  size?: MaybeFn<"xs" | "sm" | "md" | "lg" | undefined>;
  /** round (default: rounded square) · square · circle. @tr round (varsayılan: yuvarlak köşeli kare) · square · circle. */
  shape?: MaybeFn<"round" | "square" | "circle" | undefined>;
  /** Checkerboard under the colour (default true); `false` puts the page surface there. @tr Rengin altında dama deseni (varsayılan true); `false` yerine sayfa yüzeyini koyar. */
  checker?: MaybeFn<boolean | undefined>;
  /** Mark drawn on a selected swatch: `true` (a tick), an own icon / text / node, or `false` (default: the ring only). @tr Seçili renk kutusuna çizilen işaret: `true` (tik), kendi ikon / metin / düğümünüz ya da `false` (varsayılan: yalnız halka). */
  mark?: unknown;
  /** Makes it a button. @tr Onu bir düğme yapar. */
  onClick?: ((e: MouseEvent) => void) | undefined;
  /** Disables the clickable swatch. @tr Tıklanabilir renk kutusunu devre dışı bırakır. */
  disabled?: MaybeFn<boolean | undefined>;
  /** Extra CSS classes on the swatch. @tr Renk kutusuna eklenen CSS sınıfları. */
  class?: ClassProp;
  /** Content drawn over the colour (a short text such as "Aa"). @tr Rengin üstüne çizilen içerik ("Aa" gibi kısa bir metin). */
  children?: unknown;
  /** Other attributes (`role`, `aria-*`, `data-*`, `tabindex`, `title`, `id`) go to the swatch. */
  [attr: string]: unknown;
}

const isToken = (c: string): boolean => (COLOR_TOKENS as readonly string[]).includes(c) || /^(brand|cat)-[\w-]+$/.test(c);
const CHECKED = ["radio", "checkbox", "menuitemradio", "menuitemcheckbox", "switch"];

/** `<Swatch color="#ff7a1a" label="Orange" selected={$c === "#ff7a1a"} onClick={() => $c = "#ff7a1a"} />`, `<Swatch color="linear-gradient(90deg, #f60, #06f)" shape="circle" />` */
export function Swatch(props: SwatchProps): Element {
  const label = (): string | null => val(props.label) || null;
  const on = (): boolean => !!val(props.selected);
  const button = !!props.onClick, role = props.role as string | undefined;
  // how "selected" is said: aria-checked / aria-selected for the role given, aria-pressed for a plain button
  const said = props.selected === undefined ? null : role ? (CHECKED.includes(role) ? "aria-checked" : "aria-selected") : button ? "aria-pressed" : null;
  const el = h(button ? "button" : "span", {
    ...(button ? { type: "button", disabled: () => !!val(props.disabled), onClick: props.onClick, title: label } : {}),
    // a bare swatch is a picture (named) or decoration (hidden); one holding content (ColorInput's native picker lies
    // in it) is neither: its content must stay reachable
    ...(!button && !role ? (props.children != null ? {} : { role: () => (label() ? "img" : null), "aria-hidden": () => (label() ? null : "true") }) : {}),
    "aria-label": label,
    ...(said ? { [said]: () => String(on()) } : {}),
    ...rest(props, ["color", "selected", "label", "size", "shape", "checker", "mark", "onClick", "disabled"]),
    class: () => cx("m-sample", `m-sample-${val(props.size) ?? "md"}`, `m-sample-${val(props.shape) ?? "round"}`, val(props.checker) !== false && CHECKER, on() && "is-selected", val(props.class)),
  },
  h("span", { class: "m-sample-fill", "aria-hidden": "true" }),
  props.children != null ? h("span", { class: "m-sample-body" }, props.children) : null,
  props.mark == null || props.mark === false ? null : () => (on() ? h("span", { class: "m-sample-mark", "aria-hidden": "true" }, ownIcon(props.mark, check, "m-sample-mark-own")) : null)) as HTMLElement;
  // the colour: a theme token through data-m-color, anything else as a custom property (CSSOM: CSP safe)
  effect(() => {
    const c = val(props.color) || null, token = !!c && isToken(c);
    if (token) el.setAttribute("data-m-color", c as string); else el.removeAttribute("data-m-color");
    setStyle(el, { "--m-sample": token ? null : c });
  });
  return el;
}
