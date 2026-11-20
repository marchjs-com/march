// App accent color: one choice that recolors every component that has no `color` of its own (fills, focus rings, links,
// active navigation, primary buttons). setAccent("brand-green") sets <html data-m-accent>, which remaps the theme's
// primary color family (accent.css). The choice is remembered (localStorage "m.accent"). `<AccentPicker />` is the menu.
import "./accent.css";
import "./theme.css";
import { signal, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { Dropdown } from "./menu.ts";
import { val, load, save, type MaybeFn, type ClassProp } from "./util.ts";
import { droplet } from "../icons/glyphs/droplet.ts";
import { COLOR_TOKENS, type ColorToken } from "../theme/colors.ts";
import { OptionList } from "../components/forms/option-list/index.ts";
import { Swatch } from "../components/forms/swatch/index.ts";
import { ThemeSwatch, colorTheme, restyleInstantly } from "./theme.ts";
import type { Handler } from "../core/util.ts";

const KEY = "m.accent";
/** The current app accent ("primary" = the theme's own). */
export const accent = signal<ColorToken>((load<string | null>(KEY, null) as ColorToken | null) ?? "primary", { name: "accent" });

/** Recolor the app: a color token, or "primary" / null for the theme's own primary. Remembered across visits. */
export function setAccent(token: ColorToken | null | undefined): ColorToken {
  const next = (token && (COLOR_TOKENS as readonly string[]).includes(token) ? token : "primary") as ColorToken;
  accent.set(next);
  save(KEY, next === "primary" ? null : next);
  const html = globalThis.document?.documentElement;
  // the accent lands at once: no page transition (the theme wave is for color themes and light / dark)
  if (html) restyleInstantly(() => { if (next === "primary") html.removeAttribute("data-m-accent"); else html.setAttribute("data-m-accent", next); }, { transition: false });
  return next;
}
// apply the remembered choice as soon as the module loads (no flash)
if (untrack(accent) !== "primary") setAccent(untrack(accent));

/** Accent choices shown by the picker (default: the theme's primary, the HADİ colors and the semantic colors). */
export const ACCENT_CHOICES: readonly ColorToken[] = ["primary", "brand-orange", "brand-blue", "brand-green", "brand-purple", "brand-pink", "brand-gold", "info", "success", "danger", "neutral"];
const LABELS: Record<string, string> = { primary: "Theme", "brand-orange": "Orange", "brand-blue": "Blue", "brand-green": "Green", "brand-purple": "Purple", "brand-pink": "Pink", "brand-gold": "Gold", info: "Info", success: "Success", danger: "Danger", neutral: "Neutral" };

export interface AccentPickerProps {
  /** The menu button's text (default "Accent"). @tr Menü düğmesinin metni (varsayılan "Accent"). */
  label?: MaybeFn<string | undefined>;
  /** The colors offered (default ACCENT_CHOICES: the theme's primary, the HADİ colors and the semantic colors). @tr Sunulan renkler (varsayılan ACCENT_CHOICES: temanın primary rengi, HADİ renkleri ve anlamsal renkler). */
  choices?: readonly ColorToken[];
  /** Extra CSS classes on the menu button. @tr Menü düğmesine eklenen ek CSS sınıfları. */
  class?: ClassProp;
  /** Where the menu opens (default bottom-end). @tr Menünün açıldığı yön (varsayılan bottom-end). */
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
  /** An accent of its own instead of the page's (a preview, with data-m-accent on it): shows `value`, calls `onChange`. @tr Sayfanınki yerine kendine ait bir vurgu rengi (data-m-accent taşıyan bir önizleme): `value` gösterilir, `onChange` çağrılır. */
  value?: MaybeFn<ColorToken | undefined>;
  /** Called with the picked color; when given, the picker leaves the page's accent alone. @tr Seçilen renkle çağrılır; verilirse seçici sayfanın vurgu rengine dokunmaz. */
  onChange?: Handler<[c: ColorToken]> | undefined;
  /** The theme the "theme's own" swatch shows (default the page's). @tr "Temanın kendi" örneğinin gösterdiği tema (varsayılan sayfanınki). */
  theme?: MaybeFn<string | undefined>;
  /** Light or dark of that swatch (default the page's). @tr O örneğin açık ya da koyu hali (varsayılan sayfanınki). */
  mode?: MaybeFn<"light" | "dark" | null | undefined>;
}
/** What an own-value accent list shows and calls. */
export interface AccentOwn { value: () => ColorToken; onPick: (c: ColorToken) => void; theme?: (() => string) | undefined; mode?: (() => "light" | "dark" | null | undefined) | undefined }
/** The accent color choices of a theme menu (AccentPicker, ThemeMenu); `own`: another value than the page's accent. */
export function accentList(choices: readonly ColorToken[] = ACCENT_CHOICES, own?: AccentOwn): Element {
  // "primary" = the theme's own colors (a swatch scoped to the theme, untouched by the accent); the others a Swatch of the token
  const dot = (c: ColorToken): unknown => (c === "primary" ? () => h(ThemeSwatch, { id: own?.theme?.() ?? colorTheme(), mode: own?.mode }) : h(Swatch, { color: c, size: "xs", shape: "circle", checker: false }));
  return h(OptionList<ColorToken>, {
    class: "m-accent-list", label: () => t`Accent`, columns: 2, size: "sm", value: () => (own ? own.value() : accent()), onPick: (c: ColorToken) => { if (own) own.onPick(c); else setAccent(c); },
    options: choices.map((c) => ({ value: c, label: () => t(LABELS[c] ?? c), icon: dot(c) })),
  }) as Element;
}

/** Accent menu for a top bar: `<AccentPicker />` next to `<ThemePicker />`. */
export function AccentPicker(props: AccentPickerProps = {}): unknown {
  return h(Dropdown, {
    icon: droplet, label: () => val(props.label) ?? t`Accent`, placement: props.placement ?? "bottom-end", class: props.class, panelClass: "m-theme-panel m-accent-panel",
    children: [accentList(props.choices, props.onChange ? { value: () => val(props.value) ?? "primary", onPick: props.onChange, theme: () => val(props.theme) ?? colorTheme(), mode: () => val(props.mode) } : undefined)],
  });
}
