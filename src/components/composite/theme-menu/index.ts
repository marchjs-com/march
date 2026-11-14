// ThemeMenu (composite: Dropdown, ThemeSwatch, OverflowText): one top-bar menu for the whole look — light / dark /
// system, the color theme (live swatches) and the accent color. The sections are the ones ThemePicker and AccentPicker
// show on their own (themeModes, themeList, accentList), so the three stay identical.
import "./theme-menu.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Dropdown } from "../../../ui/menu.ts";
import { themeModes, themeList } from "../../../ui/theme.ts";
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
  /** Show the "Theme" / "Accent" section headings (default true). */
  headings?: boolean | undefined;
  /** Section heading texts (defaults "Theme", "Accent"). */
  labels?: { theme?: MaybeFn<string | undefined>; accent?: MaybeFn<string | undefined> } | undefined;
  /** Class of the opened panel (next to `m-theme-menu`). */
  panelClass?: string | undefined;
  class?: ClassProp;
}


/** One menu for appearance, color theme and accent: `<ThemeMenu />` (or `<ThemeMenu themes={false} accents={["primary", "brand-blue"]} />`). */
export function ThemeMenu(props: ThemeMenuProps = {}): unknown {
  const heading = (text: () => string): Element | null => props.headings === false ? null
    : h(SectionLabel, { as: "p", class: "m-theme-menu-heading", "aria-hidden": "true", label: text }) as Element;
  return h(Dropdown, {
    icon: props.icon === false ? undefined : props.icon ?? paletteIcon, label: () => val(props.label) ?? t`Appearance`, placement: props.placement ?? "bottom-end", class: props.class,
    panelClass: cx("m-theme-panel m-theme-menu", props.panelClass),
    children: [
      props.modes === false ? null : themeModes(),
      props.themes === false ? null : [heading(() => val(props.labels?.theme) ?? t`Theme`), themeList()],
      props.accents === false ? null : [heading(() => val(props.labels?.accent) ?? t`Accent`), accentList(props.accents)],
    ],
  });
}
