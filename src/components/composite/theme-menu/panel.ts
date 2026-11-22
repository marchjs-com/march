// ThemeMenu's panel: light / dark / system, the color themes and the accents (the same sections ThemePicker and
// AccentPicker show). A lazy module of its own (index.ts loads it when a menu is drawn): only the open panel needs it.
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val } from "../../../ui/util.ts";
import { themeModes, themeList } from "../../../ui/theme-pickers.ts";
import { accentList } from "../../../ui/accent-picker.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import type { ThemeMenuProps } from "./index.ts";

/** The panel's sections for these props; `own`: the menu's own theme (value / onChange) instead of the page's. */
export function themeMenuSections(props: ThemeMenuProps, own: Parameters<typeof themeList>[1]): unknown[] {
  const heading = (text: () => string): Element | null => props.headings === false ? null
    : h(SectionLabel, { as: "p", class: "m-theme-menu-heading", "aria-hidden": "true", label: text }) as Element;
  return [
    props.modes === false ? null : themeModes(),
    props.themes === false ? null : [heading(() => val(props.labels?.theme) ?? t`Theme`), themeList(props.view, own)],
    props.accents === false ? null : [heading(() => val(props.labels?.accent) ?? t`Accent`), accentList(props.accents)],
  ];
}
