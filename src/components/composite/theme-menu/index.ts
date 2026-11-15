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
  /** Button label (default "Appearance"). @tr Düğme etiketi (varsayılan "Appearance"). */
  label?: MaybeFn<string | undefined>;
  /** Show the color themes (default true). @tr Renk temalarını gösterir (varsayılan true). */
  themes?: boolean | undefined;
  /** Accent choices; false hides the accent section (default: ACCENT_CHOICES). @tr Vurgu rengi seçenekleri; false vurgu bölümünü gizler (varsayılan: ACCENT_CHOICES). */
  accents?: readonly ColorToken[] | false | undefined;
  /** Where the panel opens beside the button (default "bottom-end"). @tr Panelin düğmenin yanında açıldığı yer (varsayılan "bottom-end"). */
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end" | undefined;
  /** Button icon: your own icon, or false for a text-only button (default: the palette). @tr Düğme ikonu: kendi ikonun ya da yalnız metinli düğme için false (varsayılan: palet). */
  icon?: unknown;
  /** Show light / dark / system (default true). @tr Açık / koyu / sistem seçeneklerini gösterir (varsayılan true). */
  modes?: boolean | undefined;
  /** How the themes are drawn: "list" (default: rows with a swatch) or "cards" (a grid of preview cards, each a small page drawn by the theme). @tr Temaların çizimi: "list" (varsayılan: renk örnekli satırlar) ya da "cards" (önizleme kartları ızgarası; her biri temanın çizdiği küçük bir sayfa). */
  view?: "list" | "cards" | undefined;
  /** The button shows the current theme: its swatch and its name (default false: the icon alone). @tr Düğme geçerli temayı gösterir: renk örneği ve adı (varsayılan false: yalnız ikon). */
  current?: boolean | undefined;
  /** Show the "Theme" / "Accent" section headings (default true). @tr "Theme" / "Accent" bölüm başlıklarını gösterir (varsayılan true). */
  headings?: boolean | undefined;
  /** Section heading texts (defaults "Theme", "Accent"). @tr Bölüm başlığı metinleri (varsayılanlar "Theme", "Accent"). */
  labels?: { theme?: MaybeFn<string | undefined>; accent?: MaybeFn<string | undefined> } | undefined;
  /**
   * A theme of its own instead of the page's (a preview drawn in another theme, with `m:theme`): the menu shows `value`
   * and calls `onChange`; the page's theme is not touched.
   * @tr Sayfanınki yerine kendine ait bir tema (`m:theme` ile başka bir temada çizilen önizleme): menü `value`'yu gösterir ve `onChange`'i çağırır; sayfanın temasına dokunulmaz.
   */
  value?: MaybeFn<string | undefined>;
  /** Called with the chosen theme id (with `value`). @tr Seçilen tema id'siyle çağrılır (`value` ile). */
  onChange?: ((id: string) => void) | undefined;
  /** With `value`: a first entry "Page theme" (the value `""`): the preview follows the page's theme. @tr `value` ile: ilk girdi "Page theme" (değer `""`): önizleme sayfanın temasını izler. */
  page?: boolean | undefined;
  /** Light or dark the swatches and cards are drawn in (with `value`: the preview's mode; default the page's). @tr Renk örnekleri ve kartların çizildiği açık ya da koyu kip (`value` ile: önizlemenin kipi; varsayılan sayfanınki). */
  mode?: MaybeFn<"light" | "dark" | "system" | null | undefined>;
  /** Button size (default "md"; "sm" for a slim toolbar). @tr Düğme boyutu (varsayılan "md"; ince bir araç çubuğu için "sm"). */
  size?: "sm" | "md" | undefined;
  /** Class of the opened panel (next to `m-theme-menu`). @tr Açılan panelin sınıfı (`m-theme-menu`'nün yanında). */
  panelClass?: string | undefined;
  /** Extra classes on the button. @tr Düğmeye eklenen ek sınıflar. */
  class?: ClassProp;
}


/** One menu for appearance, color theme and accent: `<ThemeMenu />` (or `<ThemeMenu themes={false} accents={["primary", "brand-blue"]} />`). */
export function ThemeMenu(props: ThemeMenuProps = {}): unknown {
  const heading = (text: () => string): Element | null => props.headings === false ? null
    : h(SectionLabel, { as: "p", class: "m-theme-menu-heading", "aria-hidden": "true", label: text }) as Element;
  // current: the trigger is the swatch and the name of the theme in use
  const look = (): "light" | "dark" | null => { const m = val(props.mode); return m === "light" || m === "dark" ? m : null; };
  const own = props.onChange ? { value: (): string => val(props.value) ?? colorTheme(), onPick: props.onChange, mode: look, page: props.page } : undefined;
  // "" (Page theme): the page's
  const current = (): string => (own ? own.value() || colorTheme() : colorTheme());
  const name = (): string => { if (own && !own.value()) return t`Page theme`; const id = current(); return t(colorThemes().find((x) => x.id === id)?.name ?? id); };
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
