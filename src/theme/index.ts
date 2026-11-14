// hadi-march/theme — theme definitions for build tools: defineTheme, themeCss and the built-in presets.
// Runtime switching lives in hadi-march/ui (colorTheme, setColorTheme, ThemePicker).
export { defineTheme, themeCss, contrast, ensureContrast, onBrandFill, HADI, THEMES, DEFAULT_THEME, hadi, cream, night, neon, indigo, minimal, contrastTheme, aurora, noirGold, ember, voyage, graphite, paper, mint, candy, spaceTokens } from "./presets.ts";
export type { ThemeDef, ThemeColors, ThemeStyle, SurfaceKind, ShadowKind, Density } from "./presets.ts";
export { COLOR_TOKENS, type ColorToken } from "./colors.ts";
