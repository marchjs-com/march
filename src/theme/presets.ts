// HADI March themes. A theme is a small set of colors (light + dark), fonts and a base radius; everything else (hover,
// soft tints, borders, surfaces) is derived in tokens.css with color-mix(). Built-in themes are compiled to
// src/css/themes.css by tools/gen-themes.js (CSS only: switching a theme just sets data-hm-theme on <html>; CSP safe).
// Your own theme: `defineTheme({...})`, then `themeCss(def)` → write it to a .css file at build time (see README › Themes).

/** The colors a theme defines for one mode (light or dark). */
export interface ThemeColors {
  /** Page canvas. */ bg: string;
  /** Cards, inputs, popovers. */ surface: string;
  /** Raised layers (menus, dialogs); default = surface. */ raised?: string;
  /** Body text. */ text: string;
  /** Secondary text; keep ≥ 4.5:1 on surface. */ muted: string;
  /** Hairlines. */ border: string;
  /** Accent for text, icons, focus, active states; ≥ 4.5:1 on surface. */ primary: string;
  /** Filled primary buttons. */ solid: string;
  /** Text on `solid`. */ onSolid: string;
  danger: string; success: string; warn: string; info: string;
  /** Categorical palette (charts, avatars, tags): 8 colors. */ cat: readonly string[];
  /** Brand mark fill (any CSS background). */ mark: string;
  /** Glyph color on the mark (default white). */ onMark?: string;
  /** Sign-in showcase backdrop and its 4 glow colors. */ stage: string; glow: readonly string[];
  /** Highlight / special accent (default: the 4th categorical color). */ special?: string;
  /**
   * Named brand colors → `--hm-<name>`, `--hm-<name>-soft`, `--hm-on-<name>` (text on a fill of it: white when white
   * reaches the brand minimum, else the better of white / near-black) and `--hm-<name>-text` (the color darkened or
   * lightened until it reads as text on the surface, WCAG AA 4.5:1).
   */
  brand?: Readonly<Record<string, { color: string; soft?: string }>>;
}

export interface ThemeDef {
  id: string;
  name: string;
  description?: string;
  /** Body font stack. */ font: string;
  /** Headings and big numbers. */ display: string;
  displayWeight?: number;
  /** Base control radius in px (cards ≈ 1.4×, dialogs ≈ 1.9×). */ radius: number;
  light: ThemeColors;
  dark: ThemeColors;
  /** Always dark (light mode shows the dark colors). */ alwaysDark?: boolean;
  /** Preview swatches for pickers. */ swatches?: readonly string[];
}

/** Validate and freeze a theme definition. */
export function defineTheme(def: ThemeDef): ThemeDef {
  if (!/^[a-z][a-z0-9-]*$/.test(def.id)) throw new Error(`March: theme id "${def.id}" must be kebab-case.`);
  for (const m of ["light", "dark"] as const) {
    const c = def[m];
    if (!c || c.cat?.length !== 8 || c.glow?.length !== 4) throw new Error(`March: theme "${def.id}" ${m} needs 8 cat colors and 4 glow colors.`);
  }
  return Object.freeze({ ...def, swatches: def.swatches ?? [def.light.solid, def.light.primary, ...def.light.cat.slice(0, 3)] });
}

// ---- contrast helpers (WCAG relative luminance), as in HADİ's palette_math.dart
const rgb = (hex: string): [number, number, number] => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (c: readonly number[]): string => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
const lum = (h: string): number => { const [r, g, b] = rgb(h).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number); };
/** WCAG contrast ratio of two hex colors. */
export const contrast = (a: string, b: string): number => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a: string, b: string, t: number): string => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + ((y[i] as number) - v) * t)); };
/** `fg` moved toward black or white (whichever the background needs) until it reaches `min` contrast on `bg`. */
export function ensureContrast(fg: string, bg: string, min = 4.5): string {
  if (contrast(fg, bg) >= min) return fg;
  const toward = lum(bg) > 0.4 ? "#000000" : "#FFFFFF";
  for (let t = 0.05; t <= 1; t += 0.05) { const c = mix(fg, toward, t); if (contrast(c, bg) >= min + 0.02) return c; }
  return toward;
}
/** HADİ's brand rule (kBrandWhiteMinRatio 2.6): white text on a brand fill when white reaches 2.6:1, else the better of white / near-black. */
export const onBrandFill = (bg: string): string => (contrast("#FFFFFF", bg) >= 2.6 ? "#FFFFFF" : contrast("#FFFFFF", bg) >= contrast("#14181F", bg) ? "#FFFFFF" : "#14181F");

const SANS = `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const DIM = { light: { shadow: "16 24 40", overlay: "rgb(10 14 24 / .42)" }, dark: { shadow: "0 0 0", overlay: "rgb(0 0 0 / .62)" } } as const;

function modeVars(c: ThemeColors, mode: "light" | "dark"): string {
  const d = DIM[mode];
  const lines = [
    `color-scheme: ${mode};`,
    `--hm-bg: ${c.bg}; --hm-surface: ${c.surface}; --hm-surface-raised: ${c.raised ?? c.surface};`,
    `--hm-text: ${c.text}; --hm-muted: ${c.muted}; --hm-border: ${c.border};`,
    `--hm-primary: ${c.primary}; --hm-primary-solid: ${c.solid}; --hm-on-primary: ${c.onSolid};`,
    `--hm-danger: ${c.danger}; --hm-success: ${c.success}; --hm-warn: ${c.warn}; --hm-info: ${c.info};`,
    c.cat.map((x, i) => `--hm-cat-${i + 1}: ${x};`).join(" "),
    `--hm-mark: ${c.mark}; --hm-on-mark: ${c.onMark ?? "#FFFFFF"}; --hm-stage: ${c.stage};`,
    c.glow.map((x, i) => `--hm-glow-${i + 1}: ${x};`).join(" "),
    `--hm-shadow-rgb: ${d.shadow}; --hm-overlay: ${d.overlay};`,
    `--hm-special: ${c.special ?? c.cat[3]};`,
    // text tones: the color shaded until it reads as text on the surface (AA). Fills, lines, icons and indicators use the
    // pure color above; only text uses these.
    (["primary", "info", "success", "warn", "danger"] as const).map((k) => `--hm-${k}-text: ${ensureContrast(c[k], c.surface)};`).join(" "),
    `--hm-special-text: ${ensureContrast(c.special ?? c.cat[3] ?? c.primary, c.surface)};`,
    // text on a fill of the pure primary color (selected day, step number…): white when it reaches the brand minimum
    `--hm-on-primary-fill: ${onBrandFill(c.primary)};`,
    (["info", "success", "warn", "danger"] as const).map((k) => `--hm-on-${k}-fill: ${onBrandFill(c[k])};`).join(" "),
    `--hm-on-special-fill: ${onBrandFill(c.special ?? c.cat[3] ?? c.primary)};`,
    c.cat.map((x, i) => `--hm-cat-${i + 1}-text: ${ensureContrast(x, c.surface)}; --hm-on-cat-${i + 1}: ${onBrandFill(x)};`).join(" "),
    ...Object.entries(c.brand ?? {}).map(([n, b]) => `--hm-${n}: ${b.color}; --hm-${n}-soft: ${b.soft ?? `color-mix(in srgb, ${b.color} 16%, ${c.surface})`}; --hm-on-${n}: ${onBrandFill(b.color)}; --hm-${n}-text: ${ensureContrast(b.color, c.surface)};`),
  ];
  if (mode === "dark") lines.push(
    "--hm-shadow-1: 0 1px 2px rgb(0 0 0 / .4); --hm-shadow-2: 0 1px 2px rgb(0 0 0 / .4), 0 6px 18px -6px rgb(0 0 0 / .6);",
    "--hm-shadow-3: 0 0 0 1px rgb(255 255 255 / .05), 0 18px 44px -10px rgb(0 0 0 / .75); --hm-shadow-4: 0 0 0 1px rgb(255 255 255 / .07), 0 30px 80px -12px rgb(0 0 0 / .85);",
    "--hm-shadow-inset: inset 0 1px 1px rgb(0 0 0 / .25); --hm-highlight: inset 0 1px 0 rgb(255 255 255 / .06); --hm-mix-surface: 6%;");
  return lines.join("\n  ");
}

/** CSS for a theme: `[data-hm-theme="id"]` light, dark (system or data-theme="dark"). `isDefault` also targets <html> without data-hm-theme. */
export function themeCss(def: ThemeDef, isDefault = false): string {
  // A theme applies to <html data-hm-theme> and to any element with data-hm-theme (scoped previews, nested themes).
  const id = `[data-hm-theme="${def.id}"]`;
  const light = [`:root${id}`, id, ...(isDefault ? [":root:not([data-hm-theme])"] : [])].join(", ");
  const darkSys = [`:root${id}:not([data-theme="light"])`, `:root:not([data-theme="light"]) ${id}`, ...(isDefault ? [':root:not([data-hm-theme]):not([data-theme="light"])'] : [])].join(", ");
  const darkSet = [`:root${id}[data-theme="dark"]`, `:root[data-theme="dark"] ${id}`, ...(isDefault ? [':root:not([data-hm-theme])[data-theme="dark"]'] : [])].join(", ");
  const base = `--hm-font: ${def.font}, ${SANS}; --hm-font-display: ${def.display}, ${def.font}, ${SANS}; --hm-display-weight: ${def.displayWeight ?? 700}; --hm-r: ${def.radius}px;`;
  const lightVars = def.alwaysDark ? modeVars(def.dark, "dark") : modeVars(def.light, "light");
  const dark = modeVars(def.dark, "dark");
  return `/* ${def.name}${def.description ? ` — ${def.description}` : ""} */
${light} {
  ${base}
  ${lightVars}
}
@media (prefers-color-scheme: dark) {
  ${darkSys} {
  ${dark}
  }
}
${darkSet} {
  ${dark}
}
`;
}

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
export const DEFAULT_THEME = "hadi";
