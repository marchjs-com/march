// App accent color: one choice that recolors every component that has no `color` of its own (fills, focus rings, links,
// active navigation, primary buttons). setAccent("brand-green") sets <html data-hm-accent>, which remaps the theme's
// primary color family (accent.css). The choice is remembered (localStorage "hm.accent"). `<AccentPicker />` is the menu.
import "./accent.css";
import "./theme.css";
import { signal, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { Dropdown } from "./menu.ts";
import { val, cx, glyph, load, save, type MaybeFn, type ClassProp } from "./util.ts";
import { check } from "../icons/glyphs/check.ts";
import { droplet } from "../icons/glyphs/droplet.ts";
import { COLOR_TOKENS, tokenColor, type ColorToken } from "../theme/colors.ts";
import { ThemeSwatch, colorTheme, restyleInstantly } from "./theme.ts";

const KEY = "hm.accent";
/** The current app accent ("primary" = the theme's own). */
export const accent = signal<ColorToken>((load<string | null>(KEY, null) as ColorToken | null) ?? "primary", { name: "accent" });

/** Recolor the app: a color token, or "primary" / null for the theme's own primary. Remembered across visits. */
export function setAccent(token: ColorToken | null | undefined): ColorToken {
  const next = (token && (COLOR_TOKENS as readonly string[]).includes(token) ? token : "primary") as ColorToken;
  accent.set(next);
  save(KEY, next === "primary" ? null : next);
  const html = globalThis.document?.documentElement;
  if (html) restyleInstantly(() => { if (next === "primary") html.removeAttribute("data-hm-accent"); else html.setAttribute("data-hm-accent", next); });
  return next;
}
// apply the remembered choice as soon as the module loads (no flash)
if (untrack(accent) !== "primary") setAccent(untrack(accent));

/** Accent choices shown by the picker (default: the theme's primary, the HADİ colors and the semantic colors). */
export const ACCENT_CHOICES: readonly ColorToken[] = ["primary", "brand-orange", "brand-blue", "brand-green", "brand-purple", "brand-pink", "brand-gold", "info", "success", "danger", "neutral"];
const LABELS: Record<string, string> = { primary: "Theme", "brand-orange": "Orange", "brand-blue": "Blue", "brand-green": "Green", "brand-purple": "Purple", "brand-pink": "Pink", "brand-gold": "Gold", info: "Info", success: "Success", danger: "Danger", neutral: "Neutral" };

export interface AccentPickerProps { label?: MaybeFn<string | undefined>; choices?: readonly ColorToken[]; class?: ClassProp; placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end" }
/** The accent color choices of a theme menu (AccentPicker, ThemeMenu). */
export function accentList(choices: readonly ColorToken[] = ACCENT_CHOICES): Element {
  // "primary" = the theme's own colors (a swatch scoped to the theme, untouched by the accent)
  const dot = (c: ColorToken): unknown => { if (c === "primary") return () => h(ThemeSwatch, { id: colorTheme() }); const s = h("span", { class: "hm-accent-dot", "aria-hidden": "true" }) as HTMLElement; s.style.setProperty("--hm-dot", tokenColor(c)); return s; };
  return h("div", { class: "hm-accent-list", role: "radiogroup", "aria-label": () => t`Accent` },
    choices.map((c) => h("button", {
      type: "button", role: "radio", class: () => cx("hm-accent-opt", accent() === c && "is-active"), "aria-checked": () => String(accent() === c),
      onClick: () => setAccent(c),
    }, dot(c), h("span", { class: "hm-accent-name" }, () => t(LABELS[c] ?? c)), h("span", { class: "hm-theme-opt-check", "aria-hidden": "true" }, glyph(check))))) as Element;
}

/** Accent menu for a top bar: `<AccentPicker />` next to `<ThemePicker />`. */
export function AccentPicker(props: AccentPickerProps = {}): unknown {
  return h(Dropdown, {
    icon: droplet, label: () => val(props.label) ?? t`Accent`, placement: props.placement ?? "bottom-end", class: props.class, panelClass: "hm-theme-panel hm-accent-panel",
    children: [accentList(props.choices)],
  });
}
