// Theme ("system" | "light" | "dark", persisted under localStorage "hm.theme", applied as data-theme on <html>),
// ThemeToggle, LocaleSelect and UpdateBanner (new deploy detection).
import "./theme.css";
import "./theme-swatches.css";
import "./button.css";
import "./field.css";
import { signal, computed, untrack, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t, locale, setLocale } from "../core/i18n.ts";
import { val, cx, on, glyph, type MaybeFn, type ClassProp } from "./util.ts";
import { monitor } from "../icons/glyphs/monitor.ts";
import { sun } from "../icons/glyphs/sun.ts";
import { moon } from "../icons/glyphs/moon.ts";
import { x as xIcon } from "../icons/glyphs/x.ts";
import { check } from "../icons/glyphs/check.ts";
import { palette as paletteIcon } from "../icons/glyphs/palette.ts";
import { THEME_NAMES, DEFAULT_THEME } from "../theme/names.ts";
import { Dropdown } from "./menu.ts";
import { OverflowText } from "./marquee.ts";

export type ThemeMode = "system" | "light" | "dark";
const THEME_KEY = "hm.theme";
const MODES: readonly ThemeMode[] = ["system", "light", "dark"];
const isMode = (v: unknown): v is ThemeMode => MODES.includes(v as ThemeMode);
const readTheme = (): ThemeMode => { try { const v = globalThis.localStorage?.getItem(THEME_KEY); return isMode(v) ? v : "system"; } catch { return "system"; } };
const mode = signal<ThemeMode>(readTheme(), { name: "theme" });

function apply(v: ThemeMode): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (v === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", v);
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
    mode.set(v);
    try { globalThis.localStorage?.setItem(THEME_KEY, v); } catch { /* storage blocked */ }
    apply(v);
    return v;
  },
});
export const setTheme = theme.set;
/** Effective theme after resolving "system" with prefers-color-scheme (not reactive to OS changes). */
export const resolvedTheme = (): "light" | "dark" => {
  const m = mode();
  return m !== "system" ? m : globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

// ---------------------------------------------------------------- color themes (hadi, krem, gece, neon, indigo, minimal, kontrast…)
/** A theme a picker can offer (built-in ones are listed already; add your own after loading its CSS). */
export interface ThemeInfo {
  id: string;
  name: string;
  description?: string;
  /** Stylesheet URL of the theme (default: `themes/<id>.css` next to the page; see setThemeBase). */
  href?: string;
}
const THEME_NAME_KEY = "hm.colorTheme";
const infos = signal<readonly ThemeInfo[]>(THEME_NAMES.map((x) => ({ ...x })));
const readName = (): string => { try { return globalThis.localStorage?.getItem(THEME_NAME_KEY) || DEFAULT_THEME; } catch { return DEFAULT_THEME; } };
const themeName = signal<string>(readName(), { name: "colorTheme" });
let themeBase: string | null = null;
/** Where the built-in theme stylesheets live (default "themes/" relative to the page; `march build` copies them there). */
export function setThemeBase(url: string): void { themeBase = url.endsWith("/") ? url : `${url}/`; }
const hrefOf = (id: string): string => {
  const custom = infos.peek().find((x) => x.id === id)?.href;
  const d = globalThis.document;
  return new URL(custom ?? `${themeBase ?? "themes/"}${id}.css`, d?.baseURI ?? "http://localhost/").href;
};
/** Load a theme's stylesheet once (<link rel="stylesheet">, CSP style-src 'self'); resolves when it is ready (or failed). */
export function loadTheme(id: string): Promise<boolean> {
  const d = globalThis.document;
  if (!d || id === DEFAULT_THEME) return Promise.resolve(true);
  const existing = d.querySelector<HTMLLinkElement>(`link[data-hm-theme-css="${id}"]`);
  if (existing) return (existing as HTMLLinkElement & { _hmReady?: Promise<boolean> })._hmReady ?? Promise.resolve(true);
  const l = d.createElement("link") as HTMLLinkElement & { _hmReady?: Promise<boolean> };
  l.rel = "stylesheet"; l.href = hrefOf(id); l.setAttribute("data-hm-theme-css", id);
  l._hmReady = new Promise<boolean>((r) => { l.onload = () => r(true); l.onerror = () => r(false); });
  d.head.appendChild(l);
  return l._hmReady;
}
function applyName(id: string): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (id === DEFAULT_THEME) { root.removeAttribute("data-hm-theme"); return; }
  // switch only once the stylesheet is in: no flash of half-themed UI
  void loadTheme(id).then((ok) => { if (themeName.peek() !== id) return; if (ok) root.setAttribute("data-hm-theme", id); else console.warn(`March: theme "${id}" could not be loaded (${hrefOf(id)})`); });
}
applyName(themeName.peek());
/** The active color theme id (reactive). */
export const colorTheme = (): string => themeName();
/** Switch the color theme (persisted under localStorage "hm.colorTheme"); its stylesheet is loaded on demand. */
export function setColorTheme(id: string): string {
  themeName.set(id);
  try { globalThis.localStorage?.setItem(THEME_NAME_KEY, id); } catch { /* storage blocked */ }
  applyName(id);
  return id;
}
/** Themes offered by <ThemePicker> (reactive). */
export const colorThemes = (): readonly ThemeInfo[] => infos();
/** Offer extra themes: `registerThemes([{ id: "acme", name: "Acme", href: "/themes/acme.css" }])` (CSS made with themeCss()). */
export function registerThemes(list: readonly ThemeInfo[]): void { infos.update((l) => [...l.filter((x) => !list.some((y) => y.id === x.id)), ...list]); }

/** Small preview of a theme drawn by the theme itself (data-hm-theme scope; no inline styles). */
export function ThemeSwatch(props: { id: string; class?: ClassProp }): Element {
  return h("span", { class: () => cx("hm-swatch", val(props.class)), "data-hm-theme": props.id, "aria-hidden": "true" },
    h("span", { class: "hm-swatch-a" }), h("span", { class: "hm-swatch-b" }), h("span", { class: "hm-swatch-c" }), h("span", { class: "hm-swatch-d" }));
}

export interface ThemePickerProps { label?: MaybeFn<string | undefined>; class?: ClassProp; placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end" }
/** Theme menu: color themes (with live swatches) and light / dark / system. `<ThemePicker />` */
export function ThemePicker(props: ThemePickerProps = {}): unknown {
  const modeBtn = (m: ThemeMode, icon: typeof sun, label: () => string): Element => h("button", {
    type: "button", class: () => cx("hm-theme-mode", mode() === m && "is-active"), "aria-pressed": () => String(mode() === m), onClick: () => theme.set(m),
  }, glyph(icon), h("span", {}, label));
  return h(Dropdown, {
    icon: paletteIcon, label: () => val(props.label) ?? t`Theme`, placement: props.placement ?? "bottom-end", class: props.class, panelClass: "hm-theme-panel",
    children: [
      h("div", { class: "hm-theme-modes", role: "group", "aria-label": () => t`Appearance` },
        modeBtn("light", sun, () => t`Light`), modeBtn("dark", moon, () => t`Dark`), modeBtn("system", monitor, () => t`System`)),
      h("div", { class: "hm-theme-list", role: "radiogroup", "aria-label": () => t`Theme` },
        () => infos().map((x) => untrack(() => h("button", {
          type: "button", role: "radio", class: () => cx("hm-theme-opt", themeName() === x.id && "is-active"), "aria-checked": () => String(themeName() === x.id),
          onClick: () => setColorTheme(x.id),
        }, h(ThemeSwatch, { id: x.id }), h("span", { class: "hm-theme-opt-text" }, h("span", { class: "hm-theme-opt-name" }, x.name),
          x.description ? h(OverflowText, { class: "hm-theme-opt-desc" }, x.description) : null),
          h("span", { class: "hm-theme-opt-check", "aria-hidden": "true" }, glyph(check)))))),
    ],
  });
}

export interface ThemeToggleProps { class?: ClassProp }
/** Cycles system → light → dark. `<ThemeToggle />` */
export function ThemeToggle(props: ThemeToggleProps = {}): Element {
  const labels: Record<ThemeMode, () => string> = { system: () => t`System theme`, light: () => t`Light theme`, dark: () => t`Dark theme` };
  const icons = { system: monitor, light: sun, dark: moon } as const;
  return h("button", {
    type: "button", class: () => cx("hm-icon-btn", "hm-theme-toggle", val(props.class)),
    "aria-label": () => `${labels[mode()]()} — ${t`change theme`}`, title: () => labels[mode()](),
    onClick: () => theme.set(MODES[(MODES.indexOf(mode.peek()) + 1) % MODES.length] as ThemeMode),
  }, () => glyph(icons[mode()]));
}

export interface LocaleOption { value: string; label: string }
export interface LocaleSelectProps {
  /** Locales: `{ value, label }` or plain strings. */
  options: MaybeFn<readonly (LocaleOption | string)[] | null | undefined>;
  label?: MaybeFn<string | undefined>;
  onChange?: (locale: string) => void;
  class?: ClassProp;
}
/** `<LocaleSelect options={[{ value: "en", label: "English" }, { value: "tr", label: "Türkçe" }]} />` (strings allowed) */
export function LocaleSelect(props: LocaleSelectProps): Element {
  const opts = (): LocaleOption[] => (val(props.options) ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return h("select", {
    class: () => cx("hm-select", "hm-select-sm", val(props.class)), "aria-label": () => val(props.label) ?? t`Language`,
    onChange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; void setLocale(v); props.onChange?.(v); },
  }, () => opts().map((o) => h("option", { value: o.value, selected: () => locale() === o.value }, o.label)));
}

export interface UpdateBannerProps {
  /** Build id URL (default "/build.txt"). */
  url?: string;
  /** Poll interval in minutes (default 5). */
  every?: number;
  text?: MaybeFn<string | undefined>;
  reloadText?: MaybeFn<string | undefined>;
  onReload?: () => void;
  class?: ClassProp;
}
/**
 * Shows "A new version is available · Reload" when the text at `url` changes (deploys write a build id there).
 * Polls every `every` minutes and when the tab becomes visible. `<UpdateBanner url="/build.txt" every={5} />`
 */
export function UpdateBanner(props: UpdateBannerProps = {}): () => unknown {
  const url = props.url ?? "/build.txt";
  const stale = signal(false), hidden = signal(false);
  let first: string | null = null, alive = true;
  const check = async (): Promise<void> => {
    if (!alive || stale.peek() || typeof globalThis.fetch !== "function") return;
    try {
      const res = await globalThis.fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const text = (await res.text()).trim();
      if (!alive) return;
      if (first == null) first = text;
      else if (text && text !== first) stale.set(true);
    } catch { /* offline: try later */ }
  };
  void check();
  const id = setInterval(check, Math.max(0.1, props.every ?? 5) * 60_000);
  onCleanup(() => { alive = false; clearInterval(id); });
  on(globalThis.document, "visibilitychange", () => { if (globalThis.document.visibilityState !== "hidden") void check(); });
  const show = computed(() => stale() && !hidden());
  return () => show() && untrack(() => h("div", { class: () => cx("hm-update", val(props.class)), role: "status", "aria-live": "polite" },
    h("span", {}, () => val(props.text) ?? t`A new version is available`),
    h("button", { type: "button", class: "hm-btn hm-btn-primary hm-btn-sm", onClick: () => (props.onReload ?? (() => globalThis.location.reload()))() }, () => val(props.reloadText) ?? t`Reload`),
    h("button", { type: "button", class: "hm-icon-btn", "aria-label": () => t`Dismiss`, onClick: () => hidden.set(true) }, glyph(xIcon))));
}
