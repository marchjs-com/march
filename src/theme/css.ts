// Theme definitions → CSS: defineTheme, themeCss and the contrast rules they use. A module of its own: tools that build
// a theme (ThemeEditor) use it without the built-in theme definitions (presets.ts).
import { clamp } from "../core/util.ts";
import { rgb, lum, contrast } from "./contrast.ts";

export { contrast };
// March themes. A theme is a small set of colors (light + dark), fonts and a base radius; everything else (hover,
// soft tints, borders, surfaces) is derived in tokens.css with color-mix(). Built-in themes are compiled to
// src/css/themes.css by tools/gen-themes.js (CSS only: switching a theme just sets data-m-theme on <html>; CSP safe).
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
   * Named brand colors → `--m-<name>`, `--m-<name>-soft`, `--m-on-<name>` (text on a fill of it: white when white
   * reaches the brand minimum, else the better of white / near-black) and `--m-<name>-text` (the color darkened or
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
  /** Progress bars, spinners and skeletons use the first four categorical colors by default (HADİ). */ multicolor?: boolean;
  /**
   * Extra tokens for both modes, written as `--m-<name>: <value>` (names without the prefix): type scale, spacing,
   * radius steps, shadows, border width, motion… e.g. `{ "text-md": ".9375rem", "dur": "180ms", "border-w": "1.5px" }`.
   */
  tokens?: Readonly<Record<string, string>>;
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
const hex = (c: readonly number[]): string => `#${c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
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

/** Multicolor defaults (ThemeDef.multicolor): progress fill, spinner and skeleton shimmer in the first four cat colors. */
function multiVars(c: ThemeColors): string {
  const [a, b, d, e] = c.cat;
  return [
    `--m-progress-fill: linear-gradient(90deg, ${a}, ${b}, ${d}, ${e});`,
    `--m-spinner-paint: conic-gradient(from 0deg, transparent 0 8%, ${a} 20%, ${b} 45%, ${d} 70%, ${e});`,
    `--m-spinner-track: transparent; --m-spinner-head: transparent;`,
    // the shimmer itself lives with Skeleton (display.css › --m-skel-brand); the theme only switches it on
    `--m-skel-paint: var(--m-skel-brand);`,
    `--m-otp-1: ${a}; --m-otp-2: ${b}; --m-otp-3: ${d}; --m-otp-4: ${e}; --m-otp-font: var(--m-font-display);`,
  ].join(" ");
}

function modeVars(c: ThemeColors, mode: "light" | "dark"): string {
  const d = DIM[mode];
  const lines = [
    `color-scheme: ${mode};`,
    `--m-bg: ${c.bg}; --m-surface: ${c.surface}; --m-surface-raised: ${c.raised ?? c.surface};`,
    `--m-text: ${c.text}; --m-muted: ${c.muted}; --m-border: ${c.border};`,
    `--m-primary: ${c.primary}; --m-primary-solid: ${c.solid}; --m-on-primary: ${c.onSolid};`,
    `--m-danger: ${c.danger}; --m-success: ${c.success}; --m-warn: ${c.warn}; --m-info: ${c.info};`,
    c.cat.map((x, i) => `--m-cat-${i + 1}: ${x};`).join(" "),
    `--m-mark: ${c.mark}; --m-on-mark: ${c.onMark ?? "#FFFFFF"}; --m-stage: ${c.stage};`,
    c.glow.map((x, i) => `--m-glow-${i + 1}: ${x};`).join(" "),
    `--m-shadow-rgb: ${d.shadow}; --m-overlay: ${d.overlay};`,
    `--m-special: ${c.special ?? c.cat[3]};`,
    // text tones: the color shaded until it reads as text on the surface (AA). Fills, lines, icons and indicators use the
    // pure color above; only text uses these.
    (["primary", "info", "success", "warn", "danger"] as const).map((k) => `--m-${k}-text: ${ensureContrast(c[k], c.surface)};`).join(" "),
    `--m-special-text: ${ensureContrast(c.special ?? c.cat[3] ?? c.primary, c.surface)};`,
    // text on a fill of the pure primary color (selected day, step number…): white when it reaches the brand minimum
    `--m-on-primary-fill: ${onBrandFill(c.primary)};`,
    (["info", "success", "warn", "danger"] as const).map((k) => `--m-on-${k}-fill: ${onBrandFill(c[k])};`).join(" "),
    `--m-on-special-fill: ${onBrandFill(c.special ?? c.cat[3] ?? c.primary)};`,
    c.cat.map((x, i) => `--m-cat-${i + 1}-text: ${ensureContrast(x, c.surface)}; --m-on-cat-${i + 1}: ${onBrandFill(x)};`).join(" "),
    ...Object.entries(c.brand ?? {}).map(([n, b]) => `--m-${n}: ${b.color}; --m-${n}-soft: ${b.soft ?? `color-mix(in srgb, ${b.color} 16%, ${c.surface})`}; --m-on-${n}: ${onBrandFill(b.color)}; --m-${n}-text: ${ensureContrast(b.color, c.surface)};`),
  ];
  if (mode === "dark") lines.push(
    "--m-shadow-1: 0 1px 2px rgb(0 0 0 / .4); --m-shadow-2: 0 1px 2px rgb(0 0 0 / .4), 0 6px 18px -6px rgb(0 0 0 / .6);",
    "--m-shadow-3: 0 0 0 1px rgb(255 255 255 / .05), 0 18px 44px -10px rgb(0 0 0 / .75); --m-shadow-4: 0 0 0 1px rgb(255 255 255 / .07), 0 30px 80px -12px rgb(0 0 0 / .85);",
    "--m-shadow-inset: inset 0 1px 1px rgb(0 0 0 / .25); --m-highlight: inset 0 1px 0 rgb(255 255 255 / .06); --m-mix-surface: 6%;");
  return lines.join("\n  ");
}

/** CSS for a theme: `[data-m-theme="id"]` light, dark (system or data-theme="dark"). `isDefault` also targets <html> without data-m-theme. */
export function themeCss(def: ThemeDef, isDefault = false): string {
  // A theme applies to <html data-m-theme> and to any element with data-m-theme (scoped previews, nested themes).
  const id = `[data-m-theme="${def.id}"]`;
  const light = [`:root${id}`, id, ...(isDefault ? [":root:not([data-m-theme])"] : [])].join(", ");
  const darkSys = [`:root${id}:not([data-theme="light"])`, `:root:not([data-theme="light"]) ${id}`, ...(isDefault ? [':root:not([data-m-theme]):not([data-theme="light"])'] : [])].join(", ");
  const darkSet = [`:root${id}[data-theme="dark"]`, `:root[data-theme="dark"] ${id}`, ...(isDefault ? [':root:not([data-m-theme])[data-theme="dark"]'] : [])].join(", ");
  const base = `--m-font: ${def.font}, ${SANS}; --m-font-display: ${def.display}, ${def.font}, ${SANS}; --m-display-weight: ${def.displayWeight ?? 700}; --m-r: ${def.radius}px;${Object.entries(def.tokens ?? {}).map(([k, v]) => ` --m-${k}: ${v};`).join("")}`;
  const multi = (c: ThemeColors): string => !def.multicolor ? "" : `\n  ${multiVars(c)}`;
  const lightVars = (def.alwaysDark ? modeVars(def.dark, "dark") : modeVars(def.light, "light")) + multi(def.alwaysDark ? def.dark : def.light);
  const dark = modeVars(def.dark, "dark") + multi(def.dark);
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

