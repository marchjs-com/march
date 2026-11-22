// App accent color: one choice that recolors every component that has no `color` of its own (fills, focus rings, links,
// active navigation, primary buttons). setAccent("brand-green") sets <html data-m-accent>, which remaps the theme's
// primary color family (accent.css). The choice is remembered (localStorage "m.accent"). `<AccentPicker />` is the
// menu (accent-picker.ts).
import "./accent.css";
import "./theme.css";
import { signal, untrack } from "../core/reactive.ts";
import { load, save } from "./util.ts";
import { COLOR_TOKENS, type ColorToken } from "../theme/colors.ts";
import { restyleInstantly } from "./theme.ts";

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
