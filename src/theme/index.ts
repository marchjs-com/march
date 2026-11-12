// hadi-march/theme — theme definitions for build tools: defineTheme, themeCss and the built-in presets.
// Runtime switching lives in hadi-march/ui (colorTheme, setColorTheme, ThemePicker).
export { defineTheme, themeCss, contrast, ensureContrast, onBrandFill, HADI, THEMES, DEFAULT_THEME, hadi, cream, night, neon, indigo, minimal, contrastTheme } from "./presets.ts";
export type { ThemeDef, ThemeColors } from "./presets.ts";
export { COLOR_TOKENS, type ColorToken } from "./colors.ts";
