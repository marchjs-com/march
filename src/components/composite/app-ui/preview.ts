// AppPreview (march-app-ui): the preview panel of an IDE shell. A toolbar (your tools on the start side; the preview's
// own color theme, accent and light / dark on the end side: only the preview takes them, the page keeps its look) over
// a stage that shows the children in its middle. Each picker is off until asked for; the bar shows only while one is.
import "./app-ui.css";
import { signal, effect, untrack, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import tr from "../dock-layout/tr.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ThemeToggle, loadTheme, colorTheme, type ThemeMode } from "../../../ui/theme.ts";
import { AccentPicker } from "../../../ui/accent.ts";
import { ThemeMenu } from "../theme-menu/index.ts";
import { Joined } from "../../layout/joined/index.ts";
import { Menu } from "../../actions/menu/index.ts";
import { globe } from "../../../icons/glyphs/globe.ts";
import type { ColorToken } from "../../../theme/colors.ts";

messages("tr", tr);

/**
 * The tools of the preview toolbar to show: each is off unless named (a tool added later stays hidden until asked
 * for); true: every tool. The bar itself shows only while at least one of them (or your `tools`) does.
 */
export type AppPreviewToolbar = boolean | { theme?: boolean; accent?: boolean; mode?: boolean; language?: boolean };
/** A language of the preview (the language tool lists them): its code ("" for the default texts) and its name. */
export interface AppPreviewLanguage { value: string; label: string }
export interface AppPreviewProps {
  /** The preview's color theme (a signal keeps it; default "": the page's theme, whatever it becomes). */
  theme?: Signal<string> | undefined;
  /** Its accent ("primary": the theme's own). */
  accent?: Signal<ColorToken> | undefined;
  /** Light / dark ("system": the page's). */
  mode?: Signal<ThemeMode> | undefined;
  /** The preview's language (a code from `languages`; "" the default texts). */
  language?: Signal<string> | undefined;
  /** The languages the language tool offers. */
  languages?: MaybeFn<readonly AppPreviewLanguage[] | undefined>;
  /** The toolbar's pickers to show (default none: the bar is hidden while it has nothing to show). */
  toolbar?: MaybeFn<AppPreviewToolbar | undefined>;
  /** Your items at the start of the toolbar. */
  tools?: unknown;
  /** Accessible name of the toolbar (default "Preview tools"). */
  label?: MaybeFn<string | undefined>;
  /** What the preview shows, in the middle of the stage. */
  children?: unknown;
  /** Under the stage (the shown component's code). */
  footer?: unknown;
  class?: ClassProp;
}

/** `<AppPreview theme={$theme} toolbar={{ accent: false }}><MyComponent /></AppPreview>` */
export function AppPreview(props: AppPreviewProps): Element {
  const theme = props.theme ?? signal(""), accent = props.accent ?? signal<ColorToken>("primary"), mode = props.mode ?? signal<ThemeMode>("system");
  const look = (): "light" | "dark" | null => (mode() === "system" ? null : (mode() as "light" | "dark"));
  const language = props.language ?? signal("");
  const on = (k: "theme" | "accent" | "mode" | "language"): boolean => { const b = val(props.toolbar); return b === true || (typeof b === "object" && b[k] === true); };
  const anything = (): boolean => props.tools != null || on("theme") || on("accent") || on("mode") || on("language");
  // the language tool: the chosen language's name on the button, every language in its menu
  const langs = (): readonly AppPreviewLanguage[] => val(props.languages) ?? [];
  const langName = (): string => langs().find((x) => x.value === language())?.label ?? (language() || t`Default`);
  // each picker is built once (untracked): only turning it on or off draws it again
  const bar = (): unknown => (!anything() ? null : h("div", { class: "m-app-pv-bar", role: "toolbar", "aria-label": () => val(props.label) ?? t`Preview tools` },
    props.tools ?? null,
    h("span", { class: "m-app-pv-fill" }),
    () => (on("language") ? untrack(() => h(Menu, {
      size: "sm", variant: "ghost", placement: "bottom-end", label: () => t`Preview language`, class: "m-app-pv-lang",
      trigger: [h("span", { class: "m-app-pv-lang-icon", "aria-hidden": "true" }, icon(globe)), h("span", {}, langName)],
      items: () => langs().map((x) => ({ label: x.label, checked: () => language() === x.value, radio: true, onSelect: () => language.set(x.value) })),
    })) : null),
    () => (on("theme") ? untrack(() => ThemeMenu({ current: true, page: true, size: "sm", view: "cards", modes: false, accents: false, headings: false, label: () => t`Preview theme`, placement: "bottom-end", value: theme, mode, onChange: (id: string) => theme.set(id) })) : null),
    () => (on("accent") ? untrack(() => AccentPicker({ label: () => t`Preview accent`, placement: "bottom-end", value: accent, theme: () => theme() || colorTheme(), mode: look, onChange: (c: ColorToken) => accent.set(c) })) : null),
    () => (on("mode") ? untrack(() => h(ThemeToggle, { value: mode, onChange: (m: ThemeMode) => mode.set(m) })) : null)));
  // the stage is drawn in the chosen theme (its stylesheet loads when it is chosen) and mode; the accent on an inner box
  effect(() => { if (theme()) void loadTheme(theme()); });
  const stage = h("div", { class: "m-app-pv-stage", "data-m-theme": () => theme() || null, "data-theme": look },
    h("div", { class: "m-app-pv-accent", "data-m-accent": () => (accent() === "primary" ? null : accent()) }, props.children));
  // one piece (Joined): the bar, the stage and the footer read as header, body and footer; what the footer holds (a code
  // view) loses its own frame and corners too
  return h(Joined, { class: () => cx("m-app-pv", val(props.class)), radius: 0, border: false },
    bar, stage, props.footer != null ? h(Joined, { class: "m-app-pv-foot", radius: 0, border: false }, props.footer) : null) as Element;
}
