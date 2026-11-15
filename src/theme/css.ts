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

/** How cards and panels sit on the page: "soft" (a hairline and a light shadow, the default), "flat" (a hairline, no shadow), "raised" (a shadow, no hairline), "outlined" (a strong line, no shadow), "glass" (see-through and blurred over a lit page). */
export type SurfaceKind = "soft" | "flat" | "raised" | "outlined" | "glass";
/** The kind of shadow: "soft" (blurred, the default), "hard" (a solid offset block), "none". */
export type ShadowKind = "soft" | "hard" | "none";
/** How tight controls and spacing are. */
export type Density = "compact" | "normal" | "comfortable";
const DENSITY: Record<Density, number> = { compact: 0.875, normal: 1, comfortable: 1.125 };
const SPACE_STEPS = [1, 2, 3, 4, 6, 8, 12, 16];
const rem = (px: number): string => `${+(px / 16).toFixed(4)}rem`;
/** The spacing steps (`space-1` … `space-8`) and control heights of a spacing unit in px and a density, as token names → values. */
export function spaceTokens(space = 4, density: Density = "normal"): Record<string, string> {
  const k = DENSITY[density] ?? 1, o: Record<string, string> = {};
  SPACE_STEPS.forEach((step, i) => { o[`space-${i + 1}`] = rem(space * step * k); });
  if (density !== "normal") { o["control-h"] = rem(36 * k); o["control-h-sm"] = rem(30 * k); o["control-h-lg"] = rem(44 * k); }
  return o;
}

/**
 * The look of a theme beyond its colors. Each field becomes tokens the components read (`--m-panel-*`, `--m-shadow-*`,
 * `--m-primary-fill`, `--m-accent-glow`, `--m-tracking-*`, `--m-icon-stroke`, `--m-bg-image`); a field left out keeps
 * the built-in look.
 */
export interface ThemeStyle {
  /** Cards, panels, dialogs and menus. */ surface?: SurfaceKind | undefined;
  /** A glowing edge in the accent color around panels and filled buttons: 0 (none) … 1 (strong). */ glow?: number | undefined;
  shadow?: ShadowKind | undefined;
  /** Filled primary buttons: one color ("solid", the default) or a gradient from the accent to the special color. */ accent?: "solid" | "gradient" | undefined;
  /** Letter spacing of headings in em (default -0.015; 0 = none, positive = wide). */ tracking?: number | undefined;
  /** Stroke width of line icons (default 1.75). */ iconStroke?: number | undefined;
  /** Spacing and control heights: "compact", "normal" (default), "comfortable". */ density?: Density | undefined;
  /** Width of hairlines and control borders in px (default 1). */ borderWidth?: number | undefined;
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
  /** Surface kind, glow, shadow kind, gradient accent, heading tracking, icon stroke (see ThemeStyle). */
  style?: ThemeStyle | undefined;
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

/** The tokens of a theme style that do not depend on the mode's colors. */
function styleBase(st: ThemeStyle | undefined): string {
  if (!st) return " --m-primary-fill: initial; --m-primary-fill-hover: initial;";
  const out: string[] = [];
  if (st.tracking != null && st.tracking !== -0.015) out.push(`--m-tracking-tight: ${+st.tracking.toFixed(4)}em; --m-tracking-tighter: ${+(st.tracking < 0 ? st.tracking * 1.6 : st.tracking).toFixed(4)}em;`);
  if (st.iconStroke != null && st.iconStroke !== 1.75) out.push(`--m-icon-stroke: ${+st.iconStroke.toFixed(2)};`);
  if (st.density && st.density !== "normal") out.push(Object.entries(spaceTokens(4, st.density)).map(([k, v]) => `--m-${k}: ${v};`).join(" "));
  if (st.borderWidth != null && st.borderWidth !== 1) out.push(`--m-border-w: ${+st.borderWidth.toFixed(2)}px;`);
  if (st.accent === "gradient") out.push("--m-primary-fill: linear-gradient(135deg, var(--m-primary-solid), color-mix(in oklab, var(--m-primary-solid) 60%, var(--m-special))); --m-primary-fill-hover: linear-gradient(135deg, var(--m-primary-solid-hover), color-mix(in oklab, var(--m-primary-solid-hover) 60%, var(--m-special)));");
  if (st.accent !== "gradient") out.push("--m-primary-fill: initial; --m-primary-fill-hover: initial;");
  return out.map((x) => ` ${x}`).join("");
}
/** The tokens of a theme style for one mode: panel background / line / shadow / blur, the shadow steps, the glow, the lit page. */
// tokens a theme leaves to the built-in look are reset, so a theme scoped inside another one (a preview card on a
// glass page) does not inherit the outer theme's panels, fills and glow
const STYLE_TOKENS = ["panel-bg", "panel-raised-bg", "panel-filter", "panel-border", "panel-shadow", "bg-image", "accent-glow"];
const resetUnset = (lines: string[], names: readonly string[]): string => {
  const rest = names.filter((n) => !lines.some((l) => l.includes(`--m-${n}:`)));
  return rest.map((n) => `--m-${n}: initial;`).join(" ");
};
function styleMode(st: ThemeStyle | undefined, c: ThemeColors, mode: "light" | "dark"): string[] {
  const out = styleLines(st ?? {}, c, mode);
  return [...out, resetUnset(out, STYLE_TOKENS)].filter(Boolean);
}
function styleLines(st: ThemeStyle, c: ThemeColors, mode: "light" | "dark"): string[] {
  const out: string[] = [];
  const dark = mode === "dark", kind = st.surface ?? "soft", g = clamp(st.glow ?? 0, 0, 1);
  if (st.shadow === "hard") out.push(`--m-shadow-1: 2px 2px 0 ${c.text}; --m-shadow-2: 3px 3px 0 ${c.text}; --m-shadow-3: 5px 5px 0 ${c.text}; --m-shadow-4: 8px 8px 0 ${c.text}; --m-shadow-inset: none;`);
  else if (st.shadow === "none") out.push("--m-shadow-1: none; --m-shadow-2: none; --m-shadow-3: 0 0 0 1px var(--m-border-strong); --m-shadow-4: 0 0 0 1px var(--m-border-strong); --m-shadow-inset: none;");
  let shadow = kind === "flat" || kind === "outlined" ? "none" : kind === "raised" ? "var(--m-shadow-2)" : kind === "glass" ? `inset 0 1px 0 rgb(255 255 255 / ${dark ? ".1" : ".7"}), var(--m-shadow-2)` : "";
  if (kind === "raised") out.push(`--m-panel-border: ${dark ? `color-mix(in srgb, ${c.text} 7%, transparent)` : "transparent"};`);
  if (kind === "outlined") out.push("--m-panel-border: var(--m-border-strong);");
  if (kind === "glass") {
    const [a, b, d] = c.glow;
    out.push(
      `--m-panel-bg: color-mix(in srgb, ${c.surface} ${dark ? 58 : 66}%, transparent); --m-panel-raised-bg: color-mix(in srgb, ${c.raised ?? c.surface} ${dark ? 78 : 84}%, transparent);`,
      `--m-panel-filter: blur(20px) saturate(1.5); --m-panel-border: color-mix(in srgb, ${c.text} ${dark ? 14 : 10}%, transparent);`,
      // the lit page a glass panel needs behind it: three soft lights in the theme's glow colors
      `--m-bg-image: radial-gradient(56rem 38rem at 8% -8%, color-mix(in srgb, ${a} ${dark ? 34 : 22}%, transparent), transparent 62%), radial-gradient(48rem 34rem at 104% 4%, color-mix(in srgb, ${b} ${dark ? 30 : 20}%, transparent), transparent 60%), radial-gradient(52rem 36rem at 50% 112%, color-mix(in srgb, ${d} ${dark ? 26 : 16}%, transparent), transparent 62%);`);
  }
  if (g > 0) {
    const glow = `0 0 0 1px color-mix(in srgb, ${c.primary} ${Math.round(g * 46)}%, transparent), 0 0 ${Math.round(14 + g * 30)}px -6px color-mix(in srgb, ${c.primary} ${Math.round(g * 72)}%, transparent)`;
    shadow = shadow && shadow !== "none" ? `${shadow}, ${glow}` : shadow === "none" ? glow : `var(--m-shadow-1), ${glow}`;
    out.push(`--m-accent-glow: 0 6px ${Math.round(12 + g * 20)}px -6px color-mix(in srgb, ${c.solid} ${Math.round(g * 80)}%, transparent);`);
  }
  if (shadow) out.push(`--m-panel-shadow: ${shadow};`);
  return out;
}

function modeVars(c: ThemeColors, mode: "light" | "dark", st?: ThemeStyle): string {
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
  lines.push(...styleMode(st, c, mode));
  return lines.join("\n  ");
}

/** CSS for a theme: `[data-m-theme="id"]` light, dark (system or data-theme="dark"). `isDefault` also targets <html> without data-m-theme. */
export function themeCss(def: ThemeDef, isDefault = false): string {
  // A theme applies to <html data-m-theme> and to any element with data-m-theme (scoped previews, nested themes).
  const id = `[data-m-theme="${def.id}"]`;
  const light = [`:root${id}`, id, ...(isDefault ? [":root:not([data-m-theme])"] : [])].join(", ");
  // a themed element can pick its own mode too (a preview drawn light on a dark page): data-theme on the element
  const darkSys = [`:root${id}:not([data-theme="light"])`, `:root:not([data-theme="light"]) ${id}:not([data-theme="light"])`, ...(isDefault ? [':root:not([data-m-theme]):not([data-theme="light"])'] : [])].join(", ");
  const darkSet = [`:root${id}[data-theme="dark"]`, `:root[data-theme="dark"] ${id}:not([data-theme="light"])`, `${id}[data-theme="dark"]`, ...(isDefault ? [':root:not([data-m-theme])[data-theme="dark"]'] : [])].join(", ");
  const base = `--m-font: ${def.font}, ${SANS}; --m-font-display: ${def.display}, ${def.font}, ${SANS}; --m-display-weight: ${def.displayWeight ?? 700}; --m-r: ${def.radius}px;${Object.entries(def.tokens ?? {}).map(([k, v]) => ` --m-${k}: ${v};`).join("")}${styleBase(def.style)}`;
  // a theme without the multicolor defaults resets them (see STYLE_TOKENS)
  const multi = (c: ThemeColors): string => `\n  ${def.multicolor ? multiVars(c) : resetUnset([], ["progress-fill", "spinner-paint", "spinner-track", "spinner-head", "skel-paint", "otp-1", "otp-2", "otp-3", "otp-4", "otp-font"])}`;
  const lightVars = (def.alwaysDark ? modeVars(def.dark, "dark", def.style) : modeVars(def.light, "light", def.style)) + multi(def.alwaysDark ? def.dark : def.light);
  const dark = modeVars(def.dark, "dark", def.style) + multi(def.dark);
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

