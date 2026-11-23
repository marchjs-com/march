// The theme pickers (march/ui): light / dark / system (themeModes), the color theme list
// (themeList), ThemePicker, LocaleSelect and UpdateBanner. A module of their own: they draw with Segmented, OptionList,
// Select and Alert, which an app that only reads or sets the theme (or shows ThemeToggle) must not download.
import { computed, signal, untrack, onCleanup, reactive } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t, locale, setLocale } from "../core/i18n.ts";
import { val, cx, on, type MaybeFn, type ClassProp } from "./util.ts";
import { monitor } from "../icons/glyphs/monitor.ts";
import { sun } from "../icons/glyphs/sun.ts";
import { moon } from "../icons/glyphs/moon.ts";
import { palette as paletteIcon } from "../icons/glyphs/palette.ts";
import { Dropdown } from "./menu.ts";
import { Button } from "../components/actions/button/index.ts";
import { Segmented } from "../components/forms/segmented/index.ts";
import { Select } from "../components/forms/select/index.ts";
import { OptionList } from "../components/forms/option-list/index.ts";
import { OverflowText } from "../components/typography/overflow-text/index.ts";
import { Alert } from "../components/feedback/alert/index.ts";
import { trackLoad } from "../dom/loads.ts";
import type { Handler } from "../core/util.ts";
import { theme, colorTheme, colorThemes, setColorTheme, ThemeSwatch, ThemePreview, type ThemeMode } from "./theme.ts";

// a live prop for h(Component, …): it becomes a getter
const live = reactive as <T>(fn: () => T) => T;

export interface ThemePickerProps {
  /** The menu button's text (default "Theme"). @tr Menü düğmesinin metni (varsayılan "Theme"). */
  label?: MaybeFn<string | undefined>;
  /** Extra CSS classes on the menu button. @tr Menü düğmesine eklenen ek CSS sınıfları. */
  class?: ClassProp;
  /** Where the menu opens (default bottom-end). @tr Menünün açıldığı yön (varsayılan bottom-end). */
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
}
/** The light / dark / system choice of a theme menu (ThemePicker, ThemeMenu): a Segmented with icons. */
export function themeModes(): Element {
  return h(Segmented<ThemeMode>, {
    class: "m-theme-modes", ariaLabel: live(() => t`Appearance`), value: live(() => theme()), onChange: (m: ThemeMode | null) => { if (m) theme.set(m); },
    options: live(() => [{ value: "light", label: t`Light`, icon: sun }, { value: "dark", label: t`Dark`, icon: moon }, { value: "system", label: t`System`, icon: monitor }]),
  }) as Element;
}

/**
 * The color theme choices of a theme menu (ThemePicker, ThemeMenu): an OptionList. "list" (default): rows with a live
 * swatch; "cards": a grid of preview cards, each a small page drawn by the theme (ThemePreview) over its name. `own`:
 * the list shows and changes another value (a preview's theme) instead of the page's.
 */
export function themeList(view: "list" | "cards" = "list", own?: { value: () => string; onPick: (id: string) => void; mode?: (() => "light" | "dark" | null) | undefined; page?: boolean | undefined }): Element {
  const cards = view === "cards";
  // own.page: a first entry "Page theme" (the value ""): the preview follows the page's theme, whatever it becomes
  // `own`: the choice is someone else's (a preview's theme): the page's theme is not touched
  return h(OptionList<string>, {
    class: cx("m-theme-list", cards && "m-theme-cards"), label: () => t`Theme`, value: () => (own ? own.value() : colorTheme()), onPick: (id: string) => { if (own) own.onPick(id); else setColorTheme(id); },
    // theme names and descriptions are English in code; the locale pack translates them
    options: () => [
      ...(own?.page ? [{ value: "", label: () => t`Page theme`, hint: () => t(colorThemes().find((x) => x.id === colorTheme())?.name ?? colorTheme()), icon: cards ? undefined : h(ThemeSwatch, { id: colorTheme(), mode: own.mode }) }] : []),
      ...colorThemes().map((x) => ({ value: x.id, label: () => t(x.name), hint: x.description ? () => t(x.description ?? "") : undefined, icon: cards ? undefined : h(ThemeSwatch, { id: x.id, mode: own?.mode }) })),
    ],
    ...(cards ? {
      columns: 3, check: false,
      renderOption: (it: { value: string; label: unknown; hint?: unknown }) => h("span", { class: "m-theme-card" },
        // a name or description that does not fit scrolls while the card is hovered or focused (OverflowText)
        h(ThemePreview, { id: it.value || colorTheme(), mode: own?.mode }), h(OverflowText, { class: "m-theme-card-name", trigger: ["hover", "focus"], mode: "loop" }, it.label),
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

export interface LocaleOption { value: string; label: string }
export interface LocaleSelectProps {
  /** Locales: `{ value, label }` or plain strings. @tr Diller: `{ value, label }` ya da düz metinler. */
  options: MaybeFn<readonly (LocaleOption | string)[] | null | undefined>;
  /** aria-label of the select (default "Language"). @tr Seçim kutusunun aria-label'ı (varsayılan "Language"). */
  label?: MaybeFn<string | undefined>;
  /** Called with the picked locale after it is set. @tr Seçilen dil ayarlandıktan sonra onunla çağrılır. */
  onChange?: Handler<[locale: string]> | undefined;
  /** Extra CSS classes on the select. @tr Seçim kutusuna eklenen ek CSS sınıfları. */
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
  /** Build id URL (default "/build.txt"). @tr Derleme kimliğinin URL'si (varsayılan "/build.txt"). */
  url?: string;
  /** Poll interval in minutes (default 5). @tr Dakika cinsinden yoklama aralığı (varsayılan 5). */
  every?: number;
  /** The banner text (default "A new version is available"). @tr Bant metni (varsayılan "A new version is available"). */
  text?: MaybeFn<string | undefined>;
  /** The reload button's text (default "Reload"). @tr Yenile düğmesinin metni (varsayılan "Reload"). */
  reloadText?: MaybeFn<string | undefined>;
  /** Called by the reload button instead of reloading the page. @tr Sayfayı yenilemek yerine yenile düğmesi bunu çağırır. */
  onReload?: Handler<[]> | undefined;
  /** Extra CSS classes on the banner. @tr Banda eklenen ek CSS sınıfları. */
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
      // a background load for the global load listener: a poll the user did not ask for
      const res = await trackLoad(globalThis.fetch(url, { cache: "no-store" }), { kind: "file", key: url, background: true });
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
