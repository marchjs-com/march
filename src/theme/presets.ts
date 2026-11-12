import { defineTheme, ensureContrast, onBrandFill, type ThemeDef } from "./css.ts";

export { defineTheme, themeCss, contrast, ensureContrast, onBrandFill } from "./css.ts";
export type { ThemeDef, ThemeColors } from "./css.ts";

// ------------------------------------------------------------------ built-in themes
const FIGTREE = `"Figtree Variable", "Figtree"`, BRICOLAGE = `"Bricolage Grotesque Variable", "Bricolage Grotesque"`, INTER = `"InterVariable", "Inter"`;
/**
 * HADİ Sosyal's official colors (hadimobile lib/theme/hadi_colors.dart › HadiColors, HadiLight; night tones).
 * The four brand colors and their HADİ names: orange = Heyecan, blue = Aktivite, green = Dostluk, purple = İletişim.
 */
export const HADI = {
  orange: "#F2801F", blue: "#1D9AD6", green: "#78BE3A", purple: "#A3338C", pink: "#D33C73", gold: "#D9A93A", error: "#D24444",
  ink: "#17344F", ink2: "#3E5770", ink3: "#6B7F92", mist: "#F2F6F9", line: "#DCE4EB",
  night: "#0D2033", nightCard: "#152D45", nightLine: "#244460", nightText: "#E8EFF5", nightMuted: "#9DB0C2",
} as const;
/** The four-color ribbon in its official order: orange, blue, green, purple. */
const HADI_RIBBON_GRADIENT = `linear-gradient(135deg, ${HADI.orange} 0%, ${HADI.blue} 36%, ${HADI.green} 66%, ${HADI.purple} 100%)`;
const HADI_GLOW = ["rgb(242 128 31 / .7)", "rgb(29 154 214 / .6)", "rgb(120 190 58 / .45)", "rgb(163 51 140 / .55)"] as const;

/** HADİ — the HADİ Sosyal brand (default): navy ink, the four-color ribbon, Figtree + Bricolage Grotesque. */
export const hadi = defineTheme({
  id: "hadi", name: "HADİ", description: "HADİ Sosyal: navy ink and the four official colors",
  font: FIGTREE, display: BRICOLAGE, displayWeight: 700, radius: 12,
  light: {
    bg: HADI.mist, surface: "#FFFFFF", text: HADI.ink, muted: ensureContrast(HADI.ink3, "#FFFFFF"), border: HADI.line,
    // accent = orange (Heyecan), pure for fills, lines and icons; --hm-primary-text is the shade that reads as text
    primary: HADI.orange, solid: HADI.orange, onSolid: onBrandFill(HADI.orange),
    danger: HADI.error, success: HADI.green, warn: HADI.gold,
    info: HADI.blue, special: HADI.purple,
    cat: [HADI.orange, HADI.blue, HADI.green, HADI.purple, HADI.pink, HADI.gold, HADI.ink, "#0E9F8E"],
    mark: HADI_RIBBON_GRADIENT, stage: HADI.night, glow: HADI_GLOW,
    brand: {
      "brand-orange": { color: HADI.orange, soft: "#FEF0E3" }, "brand-blue": { color: HADI.blue, soft: "#E5F4FB" },
      "brand-green": { color: HADI.green, soft: "#EEF7E5" }, "brand-purple": { color: HADI.purple, soft: "#F6E8F3" },
      "brand-gold": { color: HADI.gold, soft: "#FBF3DD" }, "brand-pink": { color: HADI.pink }, "brand-navy": { color: HADI.ink },
    },
  },
  dark: {
    // HadiPreset klasik › night tones
    bg: "#0B1B2B", surface: HADI.night, raised: HADI.nightCard, text: HADI.nightText, muted: HADI.nightMuted, border: HADI.nightLine,
    primary: HADI.orange, solid: HADI.orange, onSolid: onBrandFill(HADI.orange),
    danger: HADI.error, success: HADI.green, warn: HADI.gold,
    info: HADI.blue, special: "#C95BB5",
    cat: [HADI.orange, HADI.blue, HADI.green, "#C95BB5", "#E9658F", HADI.gold, HADI.nightMuted, "#2EC4B2"],
    mark: HADI_RIBBON_GRADIENT, stage: HADI.night, glow: HADI_GLOW,
    brand: {
      "brand-orange": { color: HADI.orange }, "brand-blue": { color: HADI.blue }, "brand-green": { color: HADI.green }, "brand-purple": { color: "#C95BB5" },
      "brand-gold": { color: HADI.gold }, "brand-pink": { color: HADI.pink }, "brand-navy": { color: HADI.nightCard },
    },
  },
  swatches: [HADI.ink, HADI.orange, HADI.blue, HADI.green, HADI.purple],
  multicolor: true,
});

/** Classic Cream — HADİ on a warm off-white; espresso in the dark. */
export const cream = defineTheme({
  id: "cream", name: "Classic Cream", description: "HADİ on a warm cream background",
  font: FIGTREE, display: BRICOLAGE, displayWeight: 700, radius: 12,
  light: {
    bg: "#F7F3EA", surface: "#FDFBF7", text: "#17344F", muted: "#4E6073", border: "#E3DACB",
    primary: "#B5520A", solid: "#17344F", onSolid: "#FFFFFF",
    danger: "#B92D2D", success: "#3B7D16", warn: "#9A5200", info: "#0F6FA0",
    cat: ["#D9690C", "#1D9AD6", "#6FAE35", "#A3338C", "#C9396C", "#C79A2E", "#17344F", "#0E8F80"],
    mark: "linear-gradient(135deg, #D9690C, #C9396C 45%, #1D9AD6)",
    stage: "#1E1A15", glow: ["rgb(245 140 51 / .65)", "rgb(63 174 227 / .5)", "rgb(210 116 194 / .45)", "rgb(201 154 46 / .45)"],
  },
  dark: {
    bg: "#1A1713", surface: "#24201A", raised: "#2B261F", text: "#F4EEE3", muted: "#BDB2A0", border: "#3B342A",
    primary: "#F59A4A", solid: "#C2560A", onSolid: "#FFFFFF",
    danger: "#FF8A80", success: "#A4D46E", warn: "#F5C15A", info: "#6CC0EA",
    cat: ["#F58C33", "#3FAEE3", "#93CF5C", "#D274C2", "#E9658F", "#E2B65A", "#BDB2A0", "#3CC2AE"],
    mark: "linear-gradient(135deg, #D9690C, #C9396C 45%, #1D9AD6)",
    stage: "#1E1A15", glow: ["rgb(245 140 51 / .65)", "rgb(63 174 227 / .5)", "rgb(210 116 194 / .45)", "rgb(201 154 46 / .45)"],
  },
});

/** Night Blue — always dark navy night, cool blue. */
export const night = defineTheme({
  id: "night", name: "Night Blue", description: "Navy night, cool blue", alwaysDark: true,
  font: FIGTREE, display: BRICOLAGE, displayWeight: 700, radius: 14,
  light: {
    bg: "#F3F6FA", surface: "#FFFFFF", text: "#132A40", muted: "#4E6377", border: "#D3DEE9", primary: "#1D6AAE", solid: "#0D2033", onSolid: "#FFFFFF",
    danger: "#C23030", success: "#2F7D3A", warn: "#A35A00", info: "#1D6AAE",
    cat: ["#2E8BC0", "#4AA3E8", "#7C9CF0", "#C78BE0", "#E9658F", "#E5BE5C", "#2EC4B2", "#9DB0C2"], mark: "linear-gradient(135deg, #2E8BC0, #1D6AAE 50%, #0D2033)",
    stage: "#08131F", glow: ["rgb(74 163 232 / .6)", "rgb(92 184 236 / .5)", "rgb(199 139 224 / .45)", "rgb(46 196 178 / .35)"],
  },
  dark: {
    bg: "#0B1A2A", surface: "#13283D", raised: "#173049", text: "#E8EFF5", muted: "#9DB0C2", border: "#24425F",
    primary: "#5CB8EC", solid: "#1D6AAE", onSolid: "#FFFFFF",
    danger: "#FF8A8D", success: "#7FD8A0", warn: "#FBC25A", info: "#5CB8EC",
    cat: ["#4AA3E8", "#5CB8EC", "#7C9CF0", "#C78BE0", "#E9658F", "#E5BE5C", "#2EC4B2", "#9DB0C2"], mark: "linear-gradient(135deg, #5CB8EC, #1D6AAE 55%, #13283D)",
    stage: "#08131F", glow: ["rgb(74 163 232 / .6)", "rgb(92 184 236 / .5)", "rgb(199 139 224 / .45)", "rgb(46 196 178 / .35)"],
  },
});

/** Neon — night club: deep violet, bright neon. */
export const neon = defineTheme({
  id: "neon", name: "Neon", description: "Dark background, bright neon", alwaysDark: true,
  font: FIGTREE, display: BRICOLAGE, displayWeight: 800, radius: 12,
  light: {
    bg: "#F6F5FB", surface: "#FFFFFF", text: "#15122B", muted: "#57527A", border: "#D9D5EE", primary: "#A3127A", solid: "#15122B", onSolid: "#FFFFFF",
    danger: "#C0263A", success: "#13804F", warn: "#A35A00", info: "#0E7490",
    cat: ["#F048C8", "#9D7BFF", "#00D0E8", "#FFD84A", "#5CF2A6", "#FF7A59", "#7AA2FF", "#A9A3D6"], mark: "linear-gradient(135deg, #F048C8, #9D7BFF 50%, #00D0E8)",
    stage: "#07061A", glow: ["rgb(240 72 200 / .7)", "rgb(157 123 255 / .6)", "rgb(0 208 232 / .55)", "rgb(255 216 74 / .3)"],
  },
  dark: {
    bg: "#0B0A1A", surface: "#16142D", raised: "#1C1938", text: "#F4F2FF", muted: "#A9A3D6", border: "#2E2A52",
    primary: "#F57AD6", solid: "#C21E9C", onSolid: "#FFFFFF",
    danger: "#FF7A8A", success: "#5CF2A6", warn: "#FFD84A", info: "#4DE3F5",
    cat: ["#F048C8", "#9D7BFF", "#00D0E8", "#FFD84A", "#5CF2A6", "#FF7A59", "#7AA2FF", "#A9A3D6"], mark: "linear-gradient(135deg, #F048C8, #9D7BFF 50%, #00D0E8)",
    stage: "#07061A", glow: ["rgb(240 72 200 / .7)", "rgb(157 123 255 / .6)", "rgb(0 208 232 / .55)", "rgb(255 216 74 / .3)"],
  },
});

/** Minimal — black and white, tight and quiet (Inter). */
export const minimal = defineTheme({
  id: "minimal", name: "Minimal", description: "Black and white, plain and tight",
  font: INTER, display: INTER, displayWeight: 650, radius: 8,
  light: {
    bg: "#FAFAFA", surface: "#FFFFFF", text: "#111111", muted: "#5C5C5C", border: "#E5E5E5", primary: "#111111", solid: "#111111", onSolid: "#FFFFFF",
    danger: "#C62828", success: "#2E7D32", warn: "#A35A00", info: "#1F5FAD",
    cat: ["#111111", "#5C5C5C", "#8A8A8A", "#2563EB", "#DB2777", "#D97706", "#059669", "#7C3AED"], mark: "#111111",
    stage: "#0A0A0A", glow: ["rgb(255 255 255 / .18)", "rgb(255 255 255 / .1)", "rgb(255 255 255 / .12)", "rgb(255 255 255 / .06)"],
  },
  dark: {
    bg: "#0A0A0A", surface: "#141414", raised: "#1A1A1A", text: "#F2F2F2", muted: "#A8A8A8", border: "#262626", primary: "#F2F2F2", solid: "#F2F2F2", onSolid: "#111111", onMark: "#111111",
    danger: "#FF8A80", success: "#7BD88F", warn: "#F5C15A", info: "#7AB4FF",
    cat: ["#F2F2F2", "#A8A8A8", "#6B6B6B", "#60A5FA", "#F472B6", "#FBBF24", "#34D399", "#A78BFA"], mark: "#F2F2F2",
    stage: "#000000", glow: ["rgb(255 255 255 / .18)", "rgb(255 255 255 / .1)", "rgb(255 255 255 / .12)", "rgb(255 255 255 / .06)"],
  },
});

/** Indigo — a crisp SaaS look (Inter, indigo accent). */
export const indigo = defineTheme({
  id: "indigo", name: "Indigo", description: "Sharp, modern dashboard look",
  font: INTER, display: INTER, displayWeight: 680, radius: 8,
  light: {
    bg: "#F7F7F9", surface: "#FFFFFF", text: "#17171A", muted: "#696973", border: "#E7E7EB", primary: "#4F46E5", solid: "#4F46E5", onSolid: "#FFFFFF",
    danger: "#D42A2F", success: "#15803D", warn: "#B45309", info: "#0369A1",
    cat: ["#6366F1", "#14B8A6", "#F59E0B", "#EC4899", "#0EA5E9", "#8B5CF6", "#84CC16", "#94A3B8"], mark: "linear-gradient(140deg, #8187F8, #4F46E5 55%, #3730A3)",
    stage: "#0B0A1F", glow: ["rgb(99 102 241 / .75)", "rgb(168 85 247 / .55)", "rgb(14 165 233 / .45)", "rgb(236 72 153 / .35)"],
  },
  dark: {
    bg: "#0B0B0D", surface: "#121215", raised: "#17171B", text: "#ECECF0", muted: "#9A9AA6", border: "#24242A", primary: "#8F93FB", solid: "#5B55EA", onSolid: "#FFFFFF",
    danger: "#FF8A8D", success: "#5EE08F", warn: "#FBC25A", info: "#6FCBF5",
    cat: ["#8187F8", "#2DD4BF", "#FBBF24", "#F472B6", "#38BDF8", "#A78BFA", "#A3E635", "#94A3B8"], mark: "linear-gradient(140deg, #8187F8, #4F46E5 55%, #3730A3)",
    stage: "#0B0A1F", glow: ["rgb(99 102 241 / .75)", "rgb(168 85 247 / .55)", "rgb(14 165 233 / .45)", "rgb(236 72 153 / .35)"],
  },
});

/** High Contrast — accessibility: black, white, strong blue / yellow. */
export const contrastTheme = defineTheme({
  id: "contrast", name: "High Contrast", description: "Accessibility: black, white, yellow",
  font: FIGTREE, display: FIGTREE, displayWeight: 800, radius: 6,
  light: {
    bg: "#FFFFFF", surface: "#FFFFFF", text: "#000000", muted: "#333333", border: "#6B6B6B", primary: "#0040C0", solid: "#000000", onSolid: "#FFFFFF",
    danger: "#B00020", success: "#0A6B1F", warn: "#7A4100", info: "#0040C0",
    cat: ["#0040C0", "#000000", "#B00020", "#0A6B1F", "#6A0DAD", "#7A4100", "#00708A", "#555555"], mark: "#000000",
    stage: "#000000", glow: ["rgb(255 212 0 / .35)", "rgb(255 255 255 / .12)", "rgb(0 64 192 / .4)", "rgb(255 255 255 / .06)"],
  },
  dark: {
    bg: "#000000", surface: "#0A0A0A", raised: "#121212", text: "#FFFFFF", muted: "#E0E0E0", border: "#8A8A8A", primary: "#FFD400", solid: "#FFD400", onSolid: "#000000", onMark: "#000000",
    danger: "#FF6B6B", success: "#6BFF8F", warn: "#FFD400", info: "#7FC4FF",
    cat: ["#FFD400", "#FFFFFF", "#FF6B6B", "#6BFF8F", "#C9A0FF", "#FF9F45", "#7FC4FF", "#BDBDBD"], mark: "#FFD400",
    stage: "#000000", glow: ["rgb(255 212 0 / .35)", "rgb(255 255 255 / .12)", "rgb(0 64 192 / .4)", "rgb(255 255 255 / .06)"],
  },
});

/** Built-in themes, default first. */
export const THEMES: readonly ThemeDef[] = [hadi, cream, night, neon, indigo, minimal, contrastTheme];
/** Name of the default theme ("hadi"). */
export const DEFAULT_THEME = "hadi";
