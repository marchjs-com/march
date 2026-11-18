// AppPreview (march-app-ui): the preview panel of an IDE shell. A toolbar (your tools on the start side; the preview's
// own color theme, accent and light / dark on the end side: only the preview takes them, the page keeps its look) over
// a stage that shows the children in its middle, and a full-screen button (the preview alone fills the screen; Esc or
// the button again brings it back). Each tool is off until asked for; the bar shows only while one is.
import "./app-ui.css";
import { signal, effect, untrack, onCleanup, type Signal } from "../../../core/reactive.ts";
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
import { phone } from "../../../icons/glyphs/phone.ts";
import { monitor } from "../../../icons/glyphs/monitor.ts";
import { rotateCw } from "../../../icons/glyphs/rotateCw.ts";
import { defineIcon } from "../../../icons/svg.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

messages("tr", tr);
messages("tr", { "Full screen": "Tam ekran", "Exit full screen": "Tam ekrandan çık", "Default language": "Varsayılan Dil",
  "Screen size": "Ekran boyutu", "Fit": "Sığdır", "Fit the panel": "Panele sığdır", "Turn sideways": "Yan çevir",
  "Phone · 390 × 844": "Telefon · 390 × 844", "Tablet · 820 × 1180": "Tablet · 820 × 1180", "Laptop · 1280 × 800": "Dizüstü · 1280 × 800" });
// full screen's own pair (screen corners opening out / closing in), unlike the panels' maximize arrows
const enterFull = defineIcon("fullscreen", ["M3 8V5a2 2 0 0 1 2-2h3", "M16 3h3a2 2 0 0 1 2 2v3", "M21 16v3a2 2 0 0 1-2 2h-3", "M8 21H5a2 2 0 0 1-2-2v-3"]);
const exitFull = defineIcon("fullscreen-exit", ["M8 3v3a2 2 0 0 1-2 2H3", "M21 8h-3a2 2 0 0 1-2-2V3", "M3 16h3a2 2 0 0 1 2 2v3", "M16 21v-3a2 2 0 0 1 2-2h3"]);

/**
 * The tools of the preview toolbar to show: each is off unless named (a tool added later stays hidden until asked
 * for); true: every tool. The bar itself shows only while at least one of them (or your `tools`) does.
 */
export type AppPreviewToolbar = boolean | { theme?: boolean; accent?: boolean; mode?: boolean; language?: boolean; fullscreen?: boolean; device?: boolean };
/** A screen size the device tool offers: its name and its width × height in CSS pixels. */
export interface AppPreviewDevice { value: string; label: string; width: number; height: number }
/** The device tool's sizes by default: a phone, a tablet, a laptop. */
export const PREVIEW_DEVICES: readonly AppPreviewDevice[] = [
  { value: "phone", label: "Phone · 390 × 844", width: 390, height: 844 },
  { value: "tablet", label: "Tablet · 820 × 1180", width: 820, height: 1180 },
  { value: "laptop", label: "Laptop · 1280 × 800", width: 1280, height: 800 },
];
/** A language of the preview (the language tool lists them): its code ("" for the default texts) and its name. */
export interface AppPreviewLanguage { value: string; label: string }
export interface AppPreviewProps {
  /** The preview's color theme (a signal keeps it; default "": the page's theme, whatever it becomes). @tr Önizlemenin renk teması (bir sinyal tutar; varsayılan "": sayfanın teması, ne olursa olsun). */
  theme?: Signal<string> | undefined;
  /** Its accent ("primary": the theme's own). @tr Vurgu rengi ("primary": temanın kendi rengi). */
  accent?: Signal<ColorToken> | undefined;
  /** Light / dark ("system": the page's). @tr Açık / koyu ("system": sayfanınki). */
  mode?: Signal<ThemeMode> | undefined;
  /** The preview's language (a code from `languages`; "" the default texts). @tr Önizlemenin dili (`languages` içinden bir kod; "" varsayılan metinler). */
  language?: Signal<string> | undefined;
  /** The screen size the stage shows ("" fills the panel; a value of `devices`); with `rotate`, turned sideways. @tr Sahnenin gösterdiği ekran boyutu ("" paneli doldurur; `devices` içinden bir değer); `rotate` ile yan çevrilmiş. */
  device?: Signal<string> | undefined;
  /** The device turned sideways (its width and height swapped). @tr Cihaz yan çevrilmiş (genişliği ve yüksekliği yer değiştirir). */
  rotate?: Signal<boolean> | undefined;
  /** The sizes the device tool offers (default PREVIEW_DEVICES). @tr Cihaz aracının sunduğu boyutlar (varsayılan PREVIEW_DEVICES). */
  devices?: MaybeFn<readonly AppPreviewDevice[] | undefined>;
  /** The languages the language tool offers. @tr Dil aracının sunduğu diller. */
  languages?: MaybeFn<readonly AppPreviewLanguage[] | undefined>;
  /** The toolbar's pickers to show (default none: the bar is hidden while it has nothing to show). @tr Araç çubuğunda gösterilecek seçiciler (varsayılan hiçbiri: gösterecek bir şey yokken çubuk gizlenir). */
  toolbar?: MaybeFn<AppPreviewToolbar | undefined>;
  /** Your items at the start of the toolbar. @tr Araç çubuğunun başındaki kendi öğelerin. */
  tools?: unknown;
  /** Accessible name of the toolbar (default "Preview tools"). @tr Araç çubuğunun erişilebilir adı (varsayılan "Preview tools"). */
  label?: MaybeFn<string | undefined>;
  /** What the preview shows, in the middle of the stage. @tr Önizlemenin sahnenin ortasında gösterdiği içerik. */
  children?: unknown;
  /** Under the stage (the shown component's code). @tr Sahnenin altı (gösterilen bileşenin kodu). */
  footer?: unknown;
  /** Extra classes on the root. @tr Köke eklenen sınıflar. */
  class?: ClassProp;
}

/** `<AppPreview theme={$theme} toolbar={{ accent: false }}><MyComponent /></AppPreview>` */
export function AppPreview(props: AppPreviewProps): Element {
  const theme = props.theme ?? signal(""), accent = props.accent ?? signal<ColorToken>("primary"), mode = props.mode ?? signal<ThemeMode>("system");
  const look = (): "light" | "dark" | null => (mode() === "system" ? null : (mode() as "light" | "dark"));
  const language = props.language ?? signal("");
  const device = props.device ?? signal(""), rotate = props.rotate ?? signal(false);
  const devices = (): readonly AppPreviewDevice[] => val(props.devices) ?? PREVIEW_DEVICES;
  /** The chosen size (turned when rotated), or null: the stage fills the panel. */
  const size = (): { width: number; height: number } | null => {
    const d = devices().find((x) => x.value === device());
    return d ? (rotate() ? { width: d.height, height: d.width } : { width: d.width, height: d.height }) : null;
  };
  const on = (k: "theme" | "accent" | "mode" | "language" | "fullscreen" | "device"): boolean => { const b = val(props.toolbar); return b === true || (typeof b === "object" && b[k] === true); };
  const anything = (): boolean => props.tools != null || on("theme") || on("accent") || on("mode") || on("language") || on("fullscreen") || on("device");
  // full screen: the preview's own element fills the screen (the browser's Fullscreen API; Esc leaves it too)
  let root: HTMLElement | null = null;
  const full = signal(false);
  const doc = globalThis.document as Document | undefined;
  // where the browser refuses it (an embedded view, a frame without allow="fullscreen") the preview covers the page instead
  const cover = signal(false);
  // in full screen the toolbar floats over the top and slides away; the pointer at the top edge (or the keyboard in
  // it) brings it back. Touch screens keep it in place (CSS: only where a fine pointer hovers)
  const barShown = signal(false);
  let barTimer: ReturnType<typeof setTimeout> | undefined;
  // a menu opened from the bar keeps it (its button is expanded)
  const menuOpen = (): boolean => !!root?.querySelector(".m-app-pv-bar [aria-expanded='true']");
  const hideBarSoon = (ms = 1600): void => { clearTimeout(barTimer); barTimer = setTimeout(() => { if (menuOpen()) hideBarSoon(ms); else barShown.set(false); }, ms); };
  const onMove = (e: PointerEvent): void => {
    if (!full.peek() || !root) return;
    const top = root.getBoundingClientRect().top, over = (e.target as Element | null)?.closest?.(".m-app-pv-bar");
    if (e.clientY - top < 40 || over) { barShown.set(true); clearTimeout(barTimer); } else if (barShown.peek()) hideBarSoon(500);
  };
  effect(() => { if (full()) { barShown.set(true); hideBarSoon(); } else { clearTimeout(barTimer); barShown.set(false); } });
  onCleanup(() => clearTimeout(barTimer));
  const follow = (): void => { full.set(!!root && doc?.fullscreenElement === root); };
  // Esc leaves the cover, unless a menu, a list or a dialog is open (that one closes first)
  const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape" && cover.peek() && !e.defaultPrevented && !doc?.querySelector(".m-layer :is(.m-pop, [role=dialog], [role=menu], [role=listbox])")) { cover.set(false); full.set(false); } };
  doc?.addEventListener("fullscreenchange", follow);
  doc?.addEventListener("keydown", onKey);
  onCleanup(() => { doc?.removeEventListener("fullscreenchange", follow); doc?.removeEventListener("keydown", onKey); if (root && doc?.fullscreenElement === root) void doc.exitFullscreen?.(); });
  const toggleFull = (): void => {
    if (!root || !doc) return;
    if (cover.peek()) { cover.set(false); full.set(false); return; }
    if (doc.fullscreenElement === root) { void doc.exitFullscreen?.(); return; }
    const fallback = (): void => { if (doc.fullscreenElement !== root && !cover.peek()) { cover.set(true); full.set(true); } };
    // refused, or left pending (some embedded views never answer): the cover after a moment
    let p: Promise<void> | undefined;
    try { p = root.requestFullscreen?.(); } catch { p = undefined; }
    if (p) void p.catch(fallback); else fallback();
    setTimeout(fallback, 400);
  };
  // the language tool: the chosen language's name on the button, every language in its menu
  const langs = (): readonly AppPreviewLanguage[] => val(props.languages) ?? [];
  const langName = (): string => langs().find((x) => x.value === language())?.label ?? (language() || t`Default language`);
  // each picker is built once (untracked): only turning it on or off draws it again
  const bar = (): unknown => (!anything() ? null : h("div", { class: "m-app-pv-bar", role: "toolbar", "aria-label": () => val(props.label) ?? t`Preview tools` },
    props.tools ?? null,
    h("span", { class: "m-app-pv-fill" }),
    () => (on("language") ? untrack(() => h(Menu, {
      size: "sm", variant: "ghost", placement: "bottom-end", label: () => t`Preview language`, class: "m-app-pv-lang",
      trigger: [h("span", { class: "m-app-pv-lang-icon", "aria-hidden": "true" }, icon(globe)), h("span", {}, langName)],
      items: () => langs().map((x) => ({ label: x.label, checked: () => language() === x.value, radio: true, onSelect: () => language.set(x.value) })),
    })) : null),
    () => (on("device") ? untrack(() => h(Menu, {
      size: "sm", variant: "ghost", placement: "bottom-end", label: () => t`Screen size`, class: "m-app-pv-device",
      trigger: [h("span", { class: "m-app-pv-lang-icon", "aria-hidden": "true" }, () => icon(device() === "phone" ? phone : monitor)),
        h("span", {}, () => { const z = size(); return z ? `${z.width} × ${z.height}` : t`Fit`; })],
      items: () => [
        { label: t`Fit the panel`, checked: () => device() === "", radio: true, onSelect: () => device.set("") },
        ...devices().map((x) => ({ label: t(x.label), checked: () => device() === x.value, radio: true, onSelect: () => device.set(x.value) })),
        { label: t`Turn sideways`, icon: rotateCw, checked: () => rotate(), disabled: () => !size(), onSelect: () => rotate.set(!rotate.peek()) },
      ],
    })) : null),
    () => (on("theme") ? untrack(() => ThemeMenu({ current: true, page: true, size: "sm", view: "cards", modes: false, accents: false, headings: false, label: () => t`Preview theme`, placement: "bottom-end", value: theme, mode, onChange: (id: string) => theme.set(id) })) : null),
    () => (on("accent") ? untrack(() => AccentPicker({ label: () => t`Preview accent`, placement: "bottom-end", value: accent, theme: () => theme() || colorTheme(), mode: look, onChange: (c: ColorToken) => accent.set(c) })) : null),
    () => (on("mode") ? untrack(() => h(ThemeToggle, { value: mode, onChange: (m: ThemeMode) => mode.set(m) })) : null),
    () => (on("fullscreen") ? untrack(() => h(IconButton, { size: "sm", variant: "ghost", class: "m-app-pv-full", icon: () => (full() ? exitFull : enterFull), pressed: full, label: () => (full() ? t`Exit full screen` : t`Full screen`), onClick: toggleFull })) : null)));
  // the stage is drawn in the chosen theme (its stylesheet loads when it is chosen) and mode; the accent on an inner box
  effect(() => { if (theme()) void loadTheme(theme()); });
  // a device size: the content in a frame of that size (scrolling inside it), the stage around it
  const stage = h("div", { class: () => cx("m-app-pv-stage", size() && "is-device"), "data-m-theme": () => theme() || null, "data-theme": look },
    h("div", { class: "m-app-pv-accent", "data-m-accent": () => (accent() === "primary" ? null : accent()),
      style: () => { const z = size(); return z ? { "--m-pv-w": `${z.width}px`, "--m-pv-h": `${z.height}px` } : {}; } }, props.children));
  // one piece (Joined): the bar, the stage and the footer read as header, body and footer; what the footer holds (a code
  // view) loses its own frame and corners too
  root = h(Joined, { class: () => cx("m-app-pv", full() && "is-full", cover() && "is-cover", barShown() && "is-bar-shown", val(props.class)), radius: 0, border: false, onPointermove: onMove },
    bar, stage, props.footer != null ? h(Joined, { class: "m-app-pv-foot", radius: 0, border: false }, props.footer) : null) as HTMLElement;
  return root;
}
