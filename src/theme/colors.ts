// Color tokens a component"s `color` prop accepts (src/css/colors.css). Theme tokens only — never a raw CSS color — so a
// theme switch keeps every component consistent. Add names with defineTheme (brand / cat colors).
export const COLOR_TOKENS = ["primary", "info", "success", "warn", "danger", "special", "warning", "neutral", "brand-orange", "brand-blue", "brand-green", "brand-purple", "brand-gold", "brand-pink", "cat-1", "cat-2", "cat-3", "cat-4", "cat-5", "cat-6", "cat-7", "cat-8"] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
/** `data-hm-color` attribute value for a `color` prop (null when unset). */
export const colorAttr = (c: unknown): string | null => (typeof c === "string" && c ? c : null);
