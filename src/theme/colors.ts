// Color tokens a component"s `color` prop accepts (src/css/colors.css). Theme tokens only — never a raw CSS color — so a
// theme switch keeps every component consistent. Add names with defineTheme (brand / cat colors).
export const COLOR_TOKENS = ["primary", "info", "success", "warn", "danger", "special", "warning", "neutral", "brand-orange", "brand-blue", "brand-green", "brand-purple", "brand-gold", "brand-pink", "cat-1", "cat-2", "cat-3", "cat-4", "cat-5", "cat-6", "cat-7", "cat-8"] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
/** `data-hm-color` attribute value for a `color` prop (null when unset). */
export const colorAttr = (c: unknown): string | null => (typeof c === "string" && c ? c : null);

const BRAND = ["orange", "blue", "green", "purple"];
const BRAND_CAT: Record<string, number> = { orange: 1, blue: 2, green: 3, purple: 4, pink: 5, gold: 6 };
/** The CSS color expression of a token (theme variables only), e.g. "brand-blue" → var(--hm-brand-blue, var(--hm-cat-2)). */
export function tokenColor(token: string): string {
  if (token === "warning") return "var(--hm-warn)";
  if (token === "neutral") return "var(--hm-text-2)";
  const b = /^brand-(\w+)$/.exec(token);
  if (b) return `var(--hm-brand-${b[1]}${BRAND_CAT[b[1] as string] ? `, var(--hm-cat-${BRAND_CAT[b[1] as string]})` : ""})`;
  return `var(--hm-${token})`;
}
/** Several colors: "brand" = the four HADİ colors (orange, blue, green, purple), or a list of tokens. */
export type MultiColors = "single" | "brand" | readonly ColorToken[];
export const colorList = (c: MultiColors | undefined): string[] | null =>
  !c || c === "single" ? null : c === "brand" ? BRAND.map((x) => `brand-${x}`) : c.length ? [...c] : null;
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
