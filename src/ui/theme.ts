// Theme ("system" | "light" | "dark", persisted under localStorage "m.theme", applied as data-theme on <html>),
// ThemeToggle, LocaleSelect and UpdateBanner (new deploy detection).
import "./theme.css";
import "./theme-swatches.css";
import { signal, computed, untrack, onCleanup, reactive } from "../core/reactive.ts";
import { appUrl } from "../base/index.ts";
import { h } from "../dom/h.ts";
import { t, locale, setLocale } from "../core/i18n.ts";
import { val, cx, on, type MaybeFn, type ClassProp } from "./util.ts";
import { monitor } from "../icons/glyphs/monitor.ts";
import { sun } from "../icons/glyphs/sun.ts";
import { moon } from "../icons/glyphs/moon.ts";
import { palette as paletteIcon } from "../icons/glyphs/palette.ts";
import { THEME_NAMES, DEFAULT_THEME } from "../theme/names.ts";
import { Dropdown } from "./menu.ts";
import { Button } from "../components/actions/button/index.ts";
import { IconButton } from "../components/actions/icon-button/index.ts";
import { Segmented } from "../components/forms/segmented/index.ts";
import { Select } from "../components/forms/select/index.ts";
import { OptionList } from "../components/forms/option-list/index.ts";
import { OverflowText } from "../components/typography/overflow-text/index.ts";
import { Alert } from "../components/feedback/alert/index.ts";
import { restyleInstantly, restyleAhead } from "./restyle.ts";

// a live prop for h(Component, …): it becomes a getter
const live = reactive as <T>(fn: () => T) => T;
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
export function ThemeSwatch(props: { id: string; class?: ClassProp }): Element {
  return h("span", { class: () => cx("m-swatch", val(props.class)), "data-m-theme": props.id, "aria-hidden": "true" },
    h("span", { class: "m-swatch-a" }), h("span", { class: "m-swatch-b" }), h("span", { class: "m-swatch-c" }), h("span", { class: "m-swatch-d" }));
}

/** A small page drawn by a theme itself (ground, two surfaces, an accent bar, its text colour and corner): the picture of a theme card. */
export function ThemePreview(props: { id: string; class?: ClassProp }): Element {
  const bar = (): Element => h("span", { class: "m-theme-preview-bar" }) as Element;
  return h("span", { class: () => cx("m-swatch", "m-theme-preview", val(props.class)), "data-m-theme": props.id, "aria-hidden": "true" },
    h("span", { class: "m-theme-preview-text" }, "Aa"), bar(), bar());
}

export interface ThemePickerProps { label?: MaybeFn<string | undefined>; class?: ClassProp; placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end" }
/** The light / dark / system choice of a theme menu (ThemePicker, ThemeMenu): a Segmented with icons. */
export function themeModes(): Element {
  return h(Segmented<ThemeMode>, {
    class: "m-theme-modes", ariaLabel: live(() => t`Appearance`), value: live(() => mode()), onChange: (m: ThemeMode | null) => { if (m) theme.set(m); },
    options: live(() => [{ value: "light", label: t`Light`, icon: sun }, { value: "dark", label: t`Dark`, icon: moon }, { value: "system", label: t`System`, icon: monitor }]),
  }) as Element;
}

/**
 * The color theme choices of a theme menu (ThemePicker, ThemeMenu): an OptionList. "list" (default): rows with a live
 * swatch; "cards": a grid of preview cards, each a small page drawn by the theme (ThemePreview) over its name.
 */
export function themeList(view: "list" | "cards" = "list"): Element {
  const cards = view === "cards";
  return h(OptionList<string>, {
    class: cx("m-theme-list", cards && "m-theme-cards"), label: () => t`Theme`, value: () => themeName(), onPick: (id: string) => { setColorTheme(id); },
    // theme names and descriptions are English in code; the locale pack translates them
    options: () => infos().map((x) => ({ value: x.id, label: () => t(x.name), hint: x.description ? () => t(x.description ?? "") : undefined, icon: cards ? undefined : h(ThemeSwatch, { id: x.id }) })),
    ...(cards ? {
      columns: 3, check: false,
      renderOption: (it: { value: string; label: unknown; hint?: unknown }) => h("span", { class: "m-theme-card" },
        // a name or description that does not fit scrolls while the card is hovered or focused (OverflowText)
        h(ThemePreview, { id: it.value }), h(OverflowText, { class: "m-theme-card-name", trigger: ["hover", "focus"], mode: "loop" }, it.label),
        it.hint ? h(OverflowText, { class: "m-theme-card-desc", trigger: ["hover", "focus"], mode: "loop" }, it.hint) : null),
    } : {}),
  }) as Element;
}

/** Theme menu: color themes (with live swatches) and light / dark / system. `<ThemePicker />` */
export function ThemePicker(props: ThemePickerProps = {}): unknown {
  return h(Dropdown, {
    icon: paletteIcon, label: () => val(props.label) ?? t`Theme`, placement: props.placement ?? "bottom-end", class: props.class, panelClass: "m-theme-panel",
    children: [themeModes(), themeList()],
  });
}

export interface ThemeToggleProps { class?: ClassProp }
/** Cycles system → light → dark. `<ThemeToggle />` */
export function ThemeToggle(props: ThemeToggleProps = {}): Element {
  const labels: Record<ThemeMode, () => string> = { system: () => t`System theme`, light: () => t`Light theme`, dark: () => t`Dark theme` };
  const icons = { system: monitor, light: sun, dark: moon } as const;
  return h(IconButton, {
    class: () => cx("m-theme-toggle", val(props.class)), label: () => `${labels[mode()]()} — ${t`change theme`}`, title: () => labels[mode()](), icon: () => icons[mode()],
    onClick: () => theme.set(MODES[(MODES.indexOf(mode.peek()) + 1) % MODES.length] as ThemeMode),
  }) as Element;
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
  return h(Select<string>, {
    class: live(() => cx("m-select-sm", val(props.class))), ariaLabel: live(() => val(props.label) ?? t`Language`), placeholder: false,
    options: live(opts), value: live(() => locale()), onChange: (v: string | null) => { if (v == null) return; void setLocale(v); props.onChange?.(v); },
  }) as Element;
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
  // an Alert with its action and dismiss button, drawn as the floating pill (theme.css)
  return () => show() && untrack(() => h(Alert, {
    tone: "neutral", icon: false, class: () => cx("m-update", val(props.class)), dismissable: true, onDismiss: () => hidden.set(true),
    action: h(Button, { variant: "primary", size: "sm", onClick: () => (props.onReload ?? (() => globalThis.location.reload()))() }, () => val(props.reloadText) ?? t`Reload`),
  }, () => val(props.text) ?? t`A new version is available`));
}
