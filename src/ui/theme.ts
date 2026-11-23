// Theme ("system" | "light" | "dark", persisted under localStorage "m.theme", applied as data-theme on <html>), the
// color themes, ThemeSwatch / ThemePreview and ThemeToggle. The pickers (themeModes, themeList, ThemePicker,
// LocaleSelect, UpdateBanner) are in theme-pickers.ts (march/ui exports both): what only reads or sets the theme stays
// light. theme.ts must not import theme-pickers.ts: an import there would bring the pickers wherever the theme goes.
import "./theme.css";
import "./theme-swatches.css";
import { signal, untrack } from "../core/reactive.ts";
import { appUrl } from "../base/index.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "./util.ts";
import { monitor } from "../icons/glyphs/monitor.ts";
import { sun } from "../icons/glyphs/sun.ts";
import { moon } from "../icons/glyphs/moon.ts";
import { THEME_NAMES, DEFAULT_THEME } from "../theme/names.ts";
import { IconButton } from "../components/actions/icon-button/index.ts";
import { restyleInstantly, restyleAhead } from "./restyle.ts";
import type { Handler } from "../core/util.ts";

// The stored values are plain strings ("dark", "neon"): the format apps and boot scripts read, so not load / save (JSON).
const stored = (key: string): string | null => { try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; } };
const store = (key: string, v: string): void => { try { globalThis.localStorage?.setItem(key, v); } catch { /* storage blocked */ } };

export type ThemeMode = "system" | "light" | "dark";
const THEME_KEY = "m.theme";
const MODES: readonly ThemeMode[] = ["system", "light", "dark"];
const isMode = (v: unknown): v is ThemeMode => MODES.includes(v as ThemeMode);
const readTheme = (): ThemeMode => { const v = stored(THEME_KEY); return isMode(v) ? v : "system"; };
const mode = signal<ThemeMode>(readTheme(), { name: "theme" });

// a page-wide restyle lands in one step (restyle.ts); a transition such as the theme wave can be put around it
export { restyleInstantly, setRestyleTransition, restyleAhead, type RestyleTransition } from "./restyle.ts";

function apply(v: ThemeMode): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  restyleInstantly(() => { if (v === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", v); });
}
apply(mode.peek());

export interface Theme {
  /** Current theme preference (reactive). */
  (): ThemeMode;
  peek(): ThemeMode;
  /** Persist and apply a theme. Throws for unknown modes. */
  set(v: ThemeMode): ThemeMode;
}
/** Current theme preference (reactive). `theme.set("dark")` persists and applies it. */
export const theme: Theme = Object.assign((): ThemeMode => mode(), {
  peek: (): ThemeMode => mode.peek(),
  set: (v: ThemeMode): ThemeMode => {
    if (!isMode(v)) throw new Error(`March: theme must be one of ${MODES.join(", ")}.`);
    if (v !== mode.peek()) restyleAhead();
    mode.set(v);
    store(THEME_KEY, v);
    apply(v);
    return v;
  },
});
/** Set light, dark or system mode. */
export const setTheme = theme.set;
/** Effective theme after resolving "system" with prefers-color-scheme (not reactive to OS changes). */
export const resolvedTheme = (): "light" | "dark" => {
  const m = mode();
  return m !== "system" ? m : globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

// ---------------------------------------------------------------- color themes (hadi, cream, night, neon, indigo, minimal, contrast…)
/** A theme a picker can offer (built-in ones are listed already; add your own after loading its CSS). */
export interface ThemeInfo {
  id: string;
  name: string;
  description?: string;
  /** Stylesheet URL of the theme, relative to the app's root (default: `themes/<id>.css`; see setThemeBase). */
  href?: string;
  /** A theme made at run time (ThemeEditor): applies itself instead of loading a stylesheet; true when ready. */
  load?: () => boolean | Promise<boolean>;
}
const THEME_NAME_KEY = "m.colorTheme";
const infos = signal<readonly ThemeInfo[]>(THEME_NAMES.map((x) => ({ ...x })));
const themeName = signal<string>(stored(THEME_NAME_KEY) || DEFAULT_THEME, { name: "colorTheme" });
let themeBase: string | null = null;
/** Where the built-in theme stylesheets live (default "themes/" under the app's root, on any route; `march build` copies them there). */
export function setThemeBase(url: string): void { themeBase = url.endsWith("/") ? url : `${url}/`; }
const hrefOf = (id: string): string => {
  const custom = infos.peek().find((x) => x.id === id)?.href;
  return new URL(appUrl(custom ?? `${themeBase ?? "themes/"}${id}.css`), "http://localhost/").href;
};
/** Load a theme's stylesheet once (<link rel="stylesheet">, CSP style-src 'self'); resolves when it is ready (or failed). */
export function loadTheme(id: string): Promise<boolean> {
  const d = globalThis.document;
  if (!d || id === DEFAULT_THEME) return Promise.resolve(true);
  const own = infos.peek().find((x) => x.id === id)?.load;
  if (own) return Promise.resolve(own());
  const existing = d.querySelector<HTMLLinkElement>(`link[data-m-theme-css="${id}"]`);
  if (existing) return (existing as HTMLLinkElement & { _mReady?: Promise<boolean> })._mReady ?? Promise.resolve(true);
  const l = d.createElement("link") as HTMLLinkElement & { _mReady?: Promise<boolean> };
  l.rel = "stylesheet"; l.href = hrefOf(id); l.setAttribute("data-m-theme-css", id);
  l._mReady = new Promise<boolean>((r) => { l.onload = () => r(true); l.onerror = () => r(false); });
  d.head.appendChild(l);
  return l._mReady;
}
function applyName(id: string): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (id === DEFAULT_THEME) { restyleInstantly(() => root.removeAttribute("data-m-theme")); return; }
  // switch only once the stylesheet is in: no flash of half-themed UI
  void loadTheme(id).then((ok) => { if (themeName.peek() !== id) return; if (ok) restyleInstantly(() => root.setAttribute("data-m-theme", id)); else console.warn(`March: theme "${id}" could not be loaded (${hrefOf(id)})`); });
}
applyName(themeName.peek());
/** The active color theme id (reactive). */
export const colorTheme = (): string => themeName();
/** Switch the color theme (persisted under localStorage "m.colorTheme"); its stylesheet is loaded on demand. */
export function setColorTheme(id: string): string {
  if (id !== themeName.peek()) restyleAhead();
  themeName.set(id);
  store(THEME_NAME_KEY, id);
  applyName(id);
  return id;
}
/** Themes offered by <ThemePicker> (reactive). */
export const colorThemes = (): readonly ThemeInfo[] => infos();
/** Offer extra themes: `registerThemes([{ id: "hadi-marka", name: "HADİ", href: "themes/hadi-marka.css" }])` (CSS made with themeCss()). */
export function registerThemes(list: readonly ThemeInfo[]): void { infos.update((l) => [...l.filter((x) => !list.some((y) => y.id === x.id)), ...list]); }

/** Small preview of a theme drawn by the theme itself (data-m-theme scope; no inline styles). */
export function ThemeSwatch(props: {
  /** The theme id to draw (data-m-theme). @tr Çizilecek temanın id'si (data-m-theme). */
  id: string;
  /** Extra CSS classes on the root. @tr Köke eklenen ek CSS sınıfları. */
  class?: ClassProp;
  /** Light or dark of its own (default the page's). @tr Kendine ait açık ya da koyu hal (varsayılan sayfanınki). */
  mode?: MaybeFn<"light" | "dark" | null | undefined>;
}): Element {
  return h("span", { class: () => cx("m-swatch", val(props.class)), "data-m-theme": props.id, "data-theme": () => val(props.mode) ?? null, "aria-hidden": "true" },
    h("span", { class: "m-swatch-a" }), h("span", { class: "m-swatch-b" }), h("span", { class: "m-swatch-c" }), h("span", { class: "m-swatch-d" }));
}

/** A small page drawn by a theme itself (ground, two surfaces, an accent bar, its text colour and corner): the picture of a theme card. */
export function ThemePreview(props: {
  /** The theme id to draw (data-m-theme). @tr Çizilecek temanın id'si (data-m-theme). */
  id: string;
  /** Extra CSS classes on the root. @tr Köke eklenen ek CSS sınıfları. */
  class?: ClassProp;
  /** Light or dark of its own (default the page's). @tr Kendine ait açık ya da koyu hal (varsayılan sayfanınki). */
  mode?: MaybeFn<"light" | "dark" | null | undefined>;
}): Element {
  const bar = (): Element => h("span", { class: "m-theme-preview-bar" }) as Element;
  return h("span", { class: () => cx("m-swatch", "m-theme-preview", val(props.class)), "data-m-theme": props.id, "data-theme": () => val(props.mode) ?? null, "aria-hidden": "true" },
    h("span", { class: "m-theme-preview-text" }, "Aa"), bar(), bar());
}

export interface ThemeToggleProps {
  /** A mode of its own instead of the page's (a preview drawn light or dark): shows `value`, calls `onChange`. @tr Sayfanınki yerine kendine ait bir mod (açık ya da koyu çizilen bir önizleme): `value` gösterilir, `onChange` çağrılır. */
  value?: MaybeFn<ThemeMode | undefined>;
  /** Called with the next mode (system → light → dark); when given, the page's mode is left alone. @tr Sıradaki modla çağrılır (system → light → dark); verilirse sayfanın moduna dokunulmaz. */
  onChange?: Handler<[mode: ThemeMode]> | undefined;
  /** Extra CSS classes on the button. @tr Düğmeye eklenen ek CSS sınıfları. */
  class?: ClassProp;
}
/** Cycles system → light → dark. `<ThemeToggle />` */
export function ThemeToggle(props: ThemeToggleProps = {}): Element {
  const labels: Record<ThemeMode, () => string> = { system: () => t`System theme`, light: () => t`Light theme`, dark: () => t`Dark theme` };
  const icons = { system: monitor, light: sun, dark: moon } as const;
  const cur = (): ThemeMode => (props.onChange ? val(props.value) ?? "system" : mode());
  return h(IconButton, {
    class: () => cx("m-theme-toggle", val(props.class)), label: () => `${labels[cur()]()} — ${t`change theme`}`, title: () => labels[cur()](), icon: () => icons[cur()],
    onClick: () => { const next = MODES[(MODES.indexOf(untrack(cur)) + 1) % MODES.length] as ThemeMode; if (props.onChange) props.onChange(next); else theme.set(next); },
  }) as Element;
}
