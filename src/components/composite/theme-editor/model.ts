// ThemeEditor model: a theme draft (colors for light and dark, type, shape, motion) and everything made from it — the
// ThemeDef, its tokens and CSS (themeCss), the defineTheme code, JSON, import from JSON or CSS, share links, tone
// scales, a dark mode derived from the light one and the WCAG contrast audit. Pure functions, no DOM.
import { clamp } from "../../../core/util.ts";
import { contrast } from "../../../theme/contrast.ts";
import { defineTheme, themeCss, ensureContrast, onBrandFill, type ThemeDef, type ThemeColors } from "../../../theme/css.ts";
import { parse, format, mix } from "../color-picker/color.ts";

/** The mode a color belongs to. */
export type DraftMode = "light" | "dark";
/** The color roles a draft edits (ThemeColors names). */
export const COLOR_ROLES = ["primary", "solid", "onSolid", "special", "bg", "surface", "raised", "text", "muted", "border", "success", "warn", "danger", "info"] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];
/** HADİ's four brand colors (Heyecan, Aktivite, Dostluk, İletişim); every theme can set its own. */
export const BRAND_ROLES = ["brand-orange", "brand-blue", "brand-green", "brand-purple"] as const;
export type BrandRole = (typeof BRAND_ROLES)[number];
/** Any editable color: a role, a brand color or a categorical color ("cat-1" … "cat-8"). */
export type ColorKey = ColorRole | BrandRole | `cat-${number}`;

/** The colors of one mode. */
export interface DraftColors extends Record<ColorRole, string> {
  /** Categorical palette, 8 colors. */ cat: string[];
  /** Brand colors (`--m-<name>`); `soft` is kept until the color changes. */ brand: Record<string, { color: string; soft?: string }>;
  /** Carried over from the base theme as they are. */ mark: string; onMark?: string; stage: string; glow: string[];
}
export interface DraftType {
  /** Font stacks. */ body: string; display: string; mono: string;
  /** Body size in px (default 14). */ base: number;
  /** Type scale ratio (default 1.2, the built-in scale). */ ratio: number;
  /** Line heights. */ leading: number; leadingTight: number;
  /** Weights. */ medium: number; semibold: number; bold: number; displayWeight: number;
}
export type Density = "compact" | "normal" | "comfortable";
export interface DraftShape {
  /** Base radius in px. */ radius: number;
  /** How far the radius steps spread apart (0 = all equal, 1 = built-in, 2 = twice). */ spread: number;
  /** Spacing unit in px (space-1; default 4). */ space: number;
  density: Density;
  /** Shadow strength (0 = none, 1 = built-in, 2 = twice). */ shadow: number;
  /** Border width in px. */ border: number;
}
export interface DraftMotion {
  /** Durations in ms. */ fast: number; base: number; slow: number;
  /** cubic-bezier() curves. */ ease: string; easeOut: string; easeSpring: string;
}
/** Everything ThemeEditor edits; plain data (JSON, share links, storage). */
export interface ThemeDraft {
  id: string;
  name: string;
  description?: string;
  /** The preset it started from, or null (from scratch). */
  base: string | null;
  light: DraftColors;
  dark: DraftColors;
  type: DraftType;
  shape: DraftShape;
  motion: DraftMotion;
  multicolor?: boolean;
}

const MONO = `ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace`;
/** Built-in type, shape and motion (tokens.css): tokens equal to these are left out of the CSS. */
export const DEFAULT_TYPE: Omit<DraftType, "body" | "display"> = { mono: MONO, base: 14, ratio: 1.2, leading: 1.5, leadingTight: 1.2, medium: 500, semibold: 600, bold: 700, displayWeight: 700 };
export const DEFAULT_SHAPE: DraftShape = { radius: 12, spread: 1, space: 4, density: "normal", shadow: 1, border: 1 };
export const DEFAULT_MOTION: DraftMotion = { fast: 100, base: 150, slow: 240, ease: "cubic-bezier(.2, .8, .2, 1)", easeOut: "cubic-bezier(.16, 1, .3, 1)", easeSpring: "cubic-bezier(.34, 1.36, .64, 1)" };

// ------------------------------------------------------------------ colors
/** Any CSS color → "#rrggbb" (alpha dropped); the input itself when it does not parse. */
export const hex = (c: string): string => { const p = parse(c); return p ? format({ ...p, a: 1 }) : c; };
const blend = (a: string, b: string, t: number): string => { const x = parse(a), y = parse(b); return x && y ? format({ ...mix(x, y, t), a: 1 }) : a; };
const BRAND_CAT: Record<BrandRole, number> = { "brand-orange": 0, "brand-blue": 1, "brand-green": 2, "brand-purple": 3 };

/** The value of a color key in one mode. */
export function colorOf(c: DraftColors, key: ColorKey): string {
  if (key.startsWith("cat-")) return c.cat[Number(key.slice(4)) - 1] ?? "";
  if (key.startsWith("brand-")) return c.brand[key]?.color ?? c.cat[BRAND_CAT[key as BrandRole]] ?? "";
  return c[key as ColorRole];
}
/** A copy of the mode's colors with one key changed. */
export function withColor(c: DraftColors, key: ColorKey, value: string): DraftColors {
  if (key.startsWith("cat-")) { const cat = [...c.cat]; cat[Number(key.slice(4)) - 1] = value; return { ...c, cat }; }
  if (key.startsWith("brand-")) return { ...c, brand: { ...c.brand, [key]: { color: value } } };
  return { ...c, [key]: value };
}

/** Tone steps of a scale (50 lightest … 900 darkest; 500 is the color itself). */
export const TONE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
const TONE_MIX = [0.92, 0.84, 0.68, 0.5, 0.26, 0, 0.14, 0.3, 0.46, 0.62];
/** A 10-step tone scale of a color: tints toward white below 500, shades toward black above. */
export function toneScale(color: string): { step: number; color: string }[] {
  return TONE_STEPS.map((step, i) => ({ step, color: i < 5 ? blend(color, "#ffffff", TONE_MIX[i]!) : i === 5 ? hex(color) : blend(color, "#000000", TONE_MIX[i]!) }));
}

// ------------------------------------------------------------------ drafts
const colorsOf = (c: ThemeColors): DraftColors => {
  const brand: Record<string, { color: string; soft?: string }> = {};
  for (const [k, v] of Object.entries(c.brand ?? {})) brand[k] = v.soft ? { color: v.color, soft: v.soft } : { color: v.color };
  BRAND_ROLES.forEach((k, i) => { brand[k] ??= { color: c.cat[i] ?? c.primary }; });
  return {
    primary: c.primary, solid: c.solid, onSolid: c.onSolid, special: c.special ?? c.cat[3] ?? c.primary,
    bg: c.bg, surface: c.surface, raised: c.raised ?? c.surface, text: c.text, muted: c.muted, border: c.border,
    success: c.success, warn: c.warn, danger: c.danger, info: c.info,
    cat: [...c.cat], brand, mark: c.mark, ...(c.onMark ? { onMark: c.onMark } : {}), stage: c.stage, glow: [...c.glow],
  };
};

/** A draft of a theme definition (a built-in preset or your own). */
export function draftFromTheme(def: ThemeDef): ThemeDraft {
  return {
    id: def.id, name: def.name, ...(def.description ? { description: def.description } : {}), base: def.id,
    light: colorsOf(def.alwaysDark ? def.dark : def.light), dark: colorsOf(def.dark),
    type: { ...DEFAULT_TYPE, body: def.font, display: def.display, displayWeight: def.displayWeight ?? 700 },
    shape: { ...DEFAULT_SHAPE, radius: def.radius },
    motion: { ...DEFAULT_MOTION },
    ...(def.multicolor ? { multicolor: true } : {}),
  };
}
/** A dark mode made from the light colors: a tinted dark canvas, readable text, the accents kept (lightened where needed). */
export function deriveDark(l: DraftColors): DraftColors {
  const bg = blend(l.primary, "#0b0d12", 0.92), surface = blend(l.primary, "#12151c", 0.9), raised = blend(surface, "#ffffff", 0.05);
  const text = blend(l.primary, "#eceef2", 0.94);
  const ui = (c: string): string => ensureContrast(hex(c), surface, 3);
  const solid = hex(l.solid);
  return {
    ...l,
    bg, surface, raised, text, muted: ensureContrast(blend(text, surface, 0.38), surface, 4.5), border: blend(text, surface, 0.84),
    primary: ui(l.primary), solid, onSolid: onBrandFill(solid), special: ui(l.special),
    success: ui(l.success), warn: ui(l.warn), danger: ui(l.danger), info: ui(l.info),
    cat: l.cat.map(ui), brand: Object.fromEntries(Object.entries(l.brand).map(([k, v]) => [k, { color: v.color }])), stage: bg,
  };
}

/** A new draft from one accent color: neutral surfaces tinted by it, standard status colors, a dark mode derived. */
export function draftFromColor(seed: string, name = "My theme"): ThemeDraft {
  const p = hex(seed), surface = "#ffffff", text = blend(p, "#14181f", 0.94);
  const ui = (c: string): string => ensureContrast(c, surface, 3).toLowerCase();
  const cat = [p, "#1d9ad6", "#2f9e44", "#a3338c", "#d33c73", "#d9a93a", text, "#0e9f8e"];
  const light: DraftColors = {
    primary: p, solid: p, onSolid: onBrandFill(p), special: "#a3338c",
    bg: blend(p, "#f6f7f9", 0.97), surface, raised: surface, text, muted: ensureContrast(blend(text, surface, 0.4), surface, 4.5), border: blend(text, surface, 0.88),
    success: ui("#2f9e44"), warn: ui("#d9a93a"), danger: ui("#d0343a"), info: ui("#1d9ad6"),
    cat, brand: Object.fromEntries(BRAND_ROLES.map((k, i) => [k, { color: cat[i]! }])),
    mark: p, stage: blend(p, "#0b0d12", 0.9), glow: cat.slice(0, 4).map((c) => `${c}99`),
  };
  return {
    id: slug(name), name, base: null, light, dark: deriveDark(light),
    type: { ...DEFAULT_TYPE, body: `"Inter"`, display: `"Inter"`, displayWeight: 700 }, shape: { ...DEFAULT_SHAPE, radius: 10 }, motion: { ...DEFAULT_MOTION },
  };
}

/** A kebab-case theme id from a name ("HADİ Gece" → "hadi-gece"). */
export function slug(name: string): string {
  // accents come off after NFKD; the dotless i (U+0131) has no decomposition of its own
  const s = name.toLocaleLowerCase("tr").replace(/ı/g, "i")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return /^[a-z]/.test(s) ? s : `theme-${s || "custom"}`;
}

// ------------------------------------------------------------------ tokens
const TEXT_STEPS: readonly [string, number][] = [["2xs", -1.32], ["xs", -0.85], ["sm", -0.41], ["md", 0], ["lg", 0.73], ["xl", 1.96], ["2xl", 2.96], ["3xl", 4.53], ["4xl", 6.28], ["5xl", 7.98]];
const SPACE_STEPS = [1, 2, 3, 4, 6, 8, 12, 16];
const RADIUS_STEPS = [0.75, 1, 1.4, 1.9];
const SHADOW_ALPHA = [[0.06], [0.05, 0.12], [0.06, 0.2], [0.07, 0.32]];
const DENSITY: Record<Density, number> = { compact: 0.875, normal: 1, comfortable: 1.125 };
const rem = (px: number): string => `${+(px / 16).toFixed(4)}rem`;
const px = (n: number): string => `${+n.toFixed(2)}px`;

/** Type sizes of a draft in px (2xs … 5xl): base × ratio^step, steps fitted so ratio 1.2 gives the built-in scale. */
export function typeScale(t: Pick<DraftType, "base" | "ratio">): { name: string; px: number }[] {
  return TEXT_STEPS.map(([name, k]) => ({ name, px: Math.max(9, Math.round(t.base * t.ratio ** k * 100) / 100) }));
}

/**
 * The extra tokens of a draft (ThemeDef.tokens): type sizes, line heights, weights, mono font, radius steps, spacing,
 * control heights, shadows, border width, durations, easings and the primary tone scale. `all` also writes the ones
 * equal to the built-in values (a scoped preview needs them all).
 */
export function draftTokens(d: ThemeDraft, all = false): Record<string, string> {
  const o: Record<string, string> = {};
  const { type: t, shape: s, motion: m } = d;
  if (all || t.base !== DEFAULT_TYPE.base || t.ratio !== DEFAULT_TYPE.ratio) for (const x of typeScale(t)) o[`text-${x.name}`] = rem(x.px);
  if (all || t.leading !== DEFAULT_TYPE.leading) o["leading"] = String(t.leading);
  if (all || t.leadingTight !== DEFAULT_TYPE.leadingTight) o["leading-tight"] = String(t.leadingTight);
  if (all || t.medium !== DEFAULT_TYPE.medium) o["weight-medium"] = String(t.medium);
  if (all || t.semibold !== DEFAULT_TYPE.semibold) o["weight-semibold"] = String(t.semibold);
  if (all || t.bold !== DEFAULT_TYPE.bold) o["weight-bold"] = String(t.bold);
  if (all || t.mono !== DEFAULT_TYPE.mono) o["font-mono"] = t.mono;
  if (all || s.spread !== 1) RADIUS_STEPS.forEach((k, i) => { o[`radius-${i + 1}`] = px(s.radius * (k === 1 ? 1 : k ** s.spread)); });
  const dens = DENSITY[s.density] ?? 1;
  if (all || s.space !== DEFAULT_SHAPE.space || s.density !== "normal") SPACE_STEPS.forEach((k, i) => { o[`space-${i + 1}`] = rem(s.space * k * dens); });
  if (all || s.density !== "normal") { o["control-h"] = rem(36 * dens); o["control-h-sm"] = rem(30 * dens); o["control-h-lg"] = rem(44 * dens); }
  if (all || s.shadow !== 1) {
    const sh = (a: number): string => `rgb(var(--m-shadow-rgb, 16 24 40) / ${+(a * s.shadow).toFixed(3)})`;
    const shapes = [["0 1px 2px"], ["0 1px 2px", "0 4px 14px -4px"], ["0 2px 6px", "0 16px 40px -8px"], ["0 4px 10px", "0 28px 70px -12px"]];
    shapes.forEach((g, i) => { o[`shadow-${i + 1}`] = s.shadow <= 0 ? "none" : g.map((geo, j) => `${geo} ${sh(SHADOW_ALPHA[i]![j]!)}`).join(", "); });
  }
  if (all || s.border !== 1) o["border-w"] = px(s.border);
  if (all || m.fast !== DEFAULT_MOTION.fast) o["dur-fast"] = `${m.fast}ms`;
  if (all || m.base !== DEFAULT_MOTION.base) o["dur"] = `${m.base}ms`;
  if (all || m.slow !== DEFAULT_MOTION.slow) o["dur-slow"] = `${m.slow}ms`;
  if (all || m.ease !== DEFAULT_MOTION.ease) o["ease"] = m.ease;
  if (all || m.easeOut !== DEFAULT_MOTION.easeOut) o["ease-out"] = m.easeOut;
  if (all || m.easeSpring !== DEFAULT_MOTION.easeSpring) o["ease-spring"] = m.easeSpring;
  for (const x of toneScale(d.light.primary)) o[`primary-${x.step}`] = x.color;
  return o;
}

const colorsOut = (c: DraftColors): ThemeColors => ({
  bg: c.bg, surface: c.surface, raised: c.raised, text: c.text, muted: c.muted, border: c.border,
  primary: c.primary, solid: c.solid, onSolid: c.onSolid, danger: c.danger, success: c.success, warn: c.warn, info: c.info,
  special: c.special, cat: [...c.cat], mark: c.mark, ...(c.onMark ? { onMark: c.onMark } : {}), stage: c.stage, glow: [...c.glow],
  brand: Object.fromEntries(Object.entries(c.brand).map(([k, v]) => [k, v.soft ? { color: v.color, soft: v.soft } : { color: v.color }])),
});

/** The ThemeDef of a draft (defineTheme-checked): colors, fonts, radius and the extra tokens. */
export function draftToTheme(d: ThemeDraft, allTokens = false): ThemeDef {
  return defineTheme({
    id: d.id, name: d.name, ...(d.description ? { description: d.description } : {}),
    font: d.type.body, display: d.type.display, displayWeight: d.type.displayWeight, radius: d.shape.radius,
    light: colorsOut(d.light), dark: colorsOut(d.dark), ...(d.multicolor ? { multicolor: true } : {}), tokens: draftTokens(d, allTokens),
  });
}

/** The CSS variables of a draft for one mode, exactly as its stylesheet sets them (themeCss), all tokens included. */
export function draftVars(d: ThemeDraft, mode: DraftMode): Record<string, string> {
  const css = themeCss(draftToTheme(d, true));
  const blocks = [...css.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] ?? "");
  const out: Record<string, string> = {};
  const read = (b: string): void => { for (const m of b.matchAll(/(--m-[\w-]+|color-scheme):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim(); };
  read(blocks[0] ?? "");
  if (mode === "dark") read(blocks[blocks.length - 1] ?? "");
  return out;
}

// ------------------------------------------------------------------ contrast audit
/** One checked color pair. */
export interface ContrastCheck {
  id: string;
  fg: ColorRole; bg: ColorRole;
  /** What the pair is used for (English; the editor translates it). */ label: string;
  ratio: number; min: number; ok: boolean;
  /** The change that makes the pair pass: `fg` moved until it reaches `min` on `bg` (or `bg` when moving fg cannot). */
  fix: { key: ColorRole; color: string } | null;
}
const PAIRS: readonly [ColorRole, ColorRole, number, string][] = [
  ["text", "bg", 4.5, "Body text on the page"], ["text", "surface", 4.5, "Body text on cards"], ["muted", "surface", 4.5, "Secondary text"],
  ["text", "raised", 4.5, "Text in menus and dialogs"], ["onSolid", "solid", 4.5, "Text on filled buttons"], ["primary", "surface", 3, "Accent, focus ring"],
  ["success", "surface", 3, "Success indicator"], ["warn", "surface", 3, "Warning indicator"], ["danger", "surface", 3, "Danger indicator"], ["info", "surface", 3, "Info indicator"],
];
/** WCAG checks of a mode: text pairs need 4.5:1, accents and indicators 3:1 (WCAG 1.4.11); each failure gets a fix. */
export function contrastAudit(c: DraftColors): ContrastCheck[] {
  return PAIRS.map(([fg, bg, min, label]) => {
    const a = hex(c[fg]), b = hex(c[bg]);
    const ratio = /^#[0-9a-f]{6}$/i.test(a) && /^#[0-9a-f]{6}$/i.test(b) ? contrast(a, b) : 1;
    const ok = ratio >= min;
    let fix: ContrastCheck["fix"] = null;
    if (!ok) {
      const f = ensureContrast(a, b, min);
      fix = contrast(f, b) >= min ? { key: fg, color: f.toLowerCase() } : { key: bg, color: ensureContrast(b, a, min).toLowerCase() };
    }
    return { id: `${fg}/${bg}`, fg, bg, label, ratio: Math.round(ratio * 100) / 100, min, ok, fix };
  });
}
