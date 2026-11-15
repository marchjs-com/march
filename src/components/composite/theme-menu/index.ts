// ThemeMenu (composite: Dropdown, ThemeSwatch, OverflowText): one top-bar menu for the whole look — light / dark /
// system, the color theme (live swatches) and the accent color. The sections are the ones ThemePicker and AccentPicker
// show on their own (themeModes, themeList, accentList), so the three stay identical.
import "./theme-menu.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Dropdown } from "../../../ui/menu.ts";
import { themeModes, themeList, ThemeSwatch, colorTheme, colorThemes } from "../../../ui/theme.ts";
import { accentList } from "../../../ui/accent.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { palette as paletteIcon } from "../../../icons/glyphs/palette.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";

/** Props of <ThemeMenu>. */
export interface ThemeMenuProps {
  /** Button label (default "Appearance"). */
  label?: MaybeFn<string | undefined>;
  /** Show the color themes (default true). */
  themes?: boolean | undefined;
  /** Accent choices; false hides the accent section (default: ACCENT_CHOICES). */
  accents?: readonly ColorToken[] | false | undefined;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end" | undefined;
  /** Button icon: your own icon, or false for a text-only button (default: the palette). */
  icon?: unknown;
  /** Show light / dark / system (default true). */
  modes?: boolean | undefined;
  /** How the themes are drawn: "list" (default: rows with a swatch) or "cards" (a grid of preview cards, each a small page drawn by the theme). */
  view?: "list" | "cards" | undefined;
  /** The button shows the current theme: its swatch and its name (default false: the icon alone). */
  current?: boolean | undefined;
  /** Show the "Theme" / "Accent" section headings (default true). */
  headings?: boolean | undefined;
  /** Section heading texts (defaults "Theme", "Accent"). */
  labels?: { theme?: MaybeFn<string | undefined>; accent?: MaybeFn<string | undefined> } | undefined;
  /**
   * A theme of its own instead of the page's (a preview drawn in another theme, with `m:theme`): the menu shows `value`
   * and calls `onChange`; the page's theme is not touched.
   */
  value?: MaybeFn<string | undefined>;
  onChange?: ((id: string) => void) | undefined;
  /** Light or dark the swatches and cards are drawn in (with `value`: the preview's mode; default the page's). */
  mode?: MaybeFn<"light" | "dark" | "system" | null | undefined>;
  /** Button size (default "md"; "sm" for a slim toolbar). */
  size?: "sm" | "md" | undefined;
  /** Class of the opened panel (next to `m-theme-menu`). */
  panelClass?: string | undefined;
  class?: ClassProp;
}


/** One menu for appearance, color theme and accent: `<ThemeMenu />` (or `<ThemeMenu themes={false} accents={["primary", "brand-blue"]} />`). */
export function ThemeMenu(props: ThemeMenuProps = {}): unknown {
  const heading = (text: () => string): Element | null => props.headings === false ? null
    : h(SectionLabel, { as: "p", class: "m-theme-menu-heading", "aria-hidden": "true", label: text }) as Element;
  // current: the trigger is the swatch and the name of the theme in use
  const look = (): "light" | "dark" | null => { const m = val(props.mode); return m === "light" || m === "dark" ? m : null; };
  const own = props.onChange ? { value: (): string => val(props.value) ?? colorTheme(), onPick: props.onChange, mode: look } : undefined;
  const current = (): string => (own ? own.value() : colorTheme());
  const name = (): string => { const id = current(); return t(colorThemes().find((x) => x.id === id)?.name ?? id); };
  const trigger = props.current ? [() => h(ThemeSwatch, { id: current(), class: "m-theme-menu-swatch", mode: look }), h("span", { class: "m-theme-menu-name" }, name)] : undefined;
  return h(Dropdown, {
    ...(trigger ? { trigger, variant: "secondary" as const } : { icon: props.icon === false ? undefined : props.icon ?? paletteIcon }),
    label: () => val(props.label) ?? t`Appearance`, placement: props.placement ?? "bottom-end", size: props.size, class: cx(props.current && "m-theme-menu-btn", props.size === "sm" && "is-sm", props.class),
    panelClass: cx("m-theme-panel m-theme-menu", props.view === "cards" && "m-theme-menu-cards", props.panelClass),
    children: [
      props.modes === false ? null : themeModes(),
      props.themes === false ? null : [heading(() => val(props.labels?.theme) ?? t`Theme`), themeList(props.view, own)],
      props.accents === false ? null : [heading(() => val(props.labels?.accent) ?? t`Accent`), accentList(props.accents)],
    ],
  });
}
