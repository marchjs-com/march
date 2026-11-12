// WCAG contrast helpers on hex colors, as in HADİ's palette_math.dart. A module of their own: theme presets and color
// editors use them without pulling the theme definitions along.
export const rgb = (hex: string): [number, number, number] => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** WCAG relative luminance of a hex color. */
export const lum = (h: string): number => { const [r, g, b] = rgb(h).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number); };
/** WCAG contrast ratio of two hex colors. */
export const contrast = (a: string, b: string): number => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
