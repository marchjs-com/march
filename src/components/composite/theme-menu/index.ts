// ThemeMenu (composite: Dropdown, ThemeSwatch, OverflowText): one top-bar menu for the whole look — light / dark /
// system, the color theme (live swatches) and the accent color. The sections are the ones ThemePicker and AccentPicker
// show on their own (themeModes, themeList, accentList), so the three stay identical.
import "./theme-menu.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Dropdown } from "../../../ui/menu.ts";
import { themeModes, themeList } from "../../../ui/theme.ts";
import { accentList } from "../../../ui/accent.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { palette as paletteIcon } from "../../../icons/glyphs/palette.ts";

/** Props of <ThemeMenu>. */
export interface ThemeMenuProps {
  /** Button label (default "Appearance"). */
  label?: MaybeFn<string | undefined>;
  /** Show the color themes (default true). */
  themes?: boolean | undefined;
  /** Accent choices; false hides the accent section (default: ACCENT_CHOICES). */
  accents?: readonly ColorToken[] | false | undefined;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end" | undefined;
  class?: ClassProp;
}

const heading = (text: () => string): Element => h("p", { class: "hm-theme-menu-heading", "aria-hidden": "true" }, text) as Element;

/** One menu for appearance, color theme and accent: `<ThemeMenu />` (or `<ThemeMenu themes={false} accents={["primary", "brand-blue"]} />`). */
export function ThemeMenu(props: ThemeMenuProps = {}): unknown {
  return h(Dropdown, {
    icon: paletteIcon, label: () => val(props.label) ?? t`Appearance`, placement: props.placement ?? "bottom-end", class: props.class,
    panelClass: "hm-theme-panel hm-theme-menu",
    children: [
      themeModes(),
      props.themes === false ? null : [heading(() => t`Theme`), themeList()],
      props.accents === false ? null : [heading(() => t`Accent`), accentList(props.accents)],
    ],
  });
}
