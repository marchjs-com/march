import { effect } from "../core/reactive.ts";
// Color tokens a component"s `color` prop accepts (src/css/colors.css). Theme tokens only — never a raw CSS color — so a
// theme switch keeps every component consistent. Add names with defineTheme (brand / cat colors).
/** Every colour token the components accept (theme tokens only, never a raw CSS colour). */
export const COLOR_TOKENS = ["primary", "info", "success", "warn", "danger", "special", "warning", "neutral", "brand-orange", "brand-blue", "brand-green", "brand-purple", "brand-gold", "brand-pink", "gold", "cat-1", "cat-2", "cat-3", "cat-4", "cat-5", "cat-6", "cat-7", "cat-8"] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
/** `data-m-color` attribute value for a `color` prop (null when unset). */
export const colorAttr = (c: unknown): string | null => (typeof c === "string" && c ? c : null);

/**
 * Inside the library: the colour scope of what a component returned (what `m:color` does, without loading the common
 * props): `withColor(h(Rating, props), "brand-blue")`. The value may be live (a function); an element gets the
 * attribute, a list each of its elements, a live region the element it shows.
 */
export function withColor<T>(target: T, color: unknown): T {
  if (typeof target === "function") return (() => withColor((target as () => unknown)(), color)) as T;
  if (Array.isArray(target)) return target.map((x) => withColor(x, color)) as T;
  const el = target as Element | null;
  if (el && el.nodeType === 1) {
    const set = (v: unknown): void => { const c = colorAttr(v); if (c) el.setAttribute("data-m-color", c); else el.removeAttribute("data-m-color"); };
    if (typeof color === "function") effect(() => set((color as () => unknown)())); else set(color);
  }
  return target;
}

/** The four HADİ brand colors in their order (orange, blue, green, purple): the one list every "brand" option uses. */
export const BRAND_COLORS = ["brand-orange", "brand-blue", "brand-green", "brand-purple"] as const satisfies readonly ColorToken[];
/** The six brand colors: the four above plus pink and gold. */
export const BRAND_COLORS_ALL = ["brand-orange", "brand-blue", "brand-green", "brand-purple", "brand-pink", "brand-gold"] as const satisfies readonly ColorToken[];
const BRAND_CAT: Record<string, number> = { orange: 1, blue: 2, green: 3, purple: 4, pink: 5, gold: 6 };
/** The CSS color expression of a token (theme variables only), e.g. "brand-blue" → var(--m-brand-blue, var(--m-cat-2)). */
export function tokenColor(token: string): string {
  if (token === "warning") return "var(--m-warn)";
  if (token === "neutral") return "var(--m-text-2)";
  if (token === "gold") return "var(--m-brand-gold, var(--m-cat-6))";
  const b = /^brand-(\w+)$/.exec(token);
  if (b) return `var(--m-brand-${b[1]}${BRAND_CAT[b[1] as string] ? `, var(--m-cat-${BRAND_CAT[b[1] as string]})` : ""})`;
  return `var(--m-${token})`;
}
/** Several colors: "brand" = the four HADİ colors (orange, blue, green, purple), or a list of tokens. */
export type MultiColors = "single" | "brand" | readonly ColorToken[];
export const colorList = (c: MultiColors | undefined): string[] | null =>
  !c || c === "single" ? null : c === "brand" ? [...BRAND_COLORS] : c.length ? [...c] : null;
/**
 * A paint for several colors. gradient: smooth; segments: equal hard-edged parts; the angle is "90deg" for bars and a
 * conic start ("from -90deg") for rings. `closed` repeats the first color at the end (a seamless loop).
 */
export function paintOf(tokens: readonly string[], kind: "gradient" | "segments", shape: "linear" | "conic", closed = false): string {
  const cs = tokens.map(tokenColor);
  const stops = kind === "segments"
    ? cs.map((c, i) => `${c} ${(i * 100) / cs.length}% ${((i + 1) * 100) / cs.length}%`).join(", ")
    : [...cs, ...(closed ? [cs[0] as string] : [])].join(", ");
  return shape === "conic" ? `conic-gradient(from 0deg, ${stops})` : `linear-gradient(90deg, ${stops})`;
}
