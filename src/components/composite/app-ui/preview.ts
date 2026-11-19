// AppPreview (march-app-ui): the preview panel of an IDE shell. A toolbar (your tools on the start side; the preview's
// own color theme, accent and light / dark on the end side: only the preview takes them, the page keeps its look) over
// a stage that shows the children in its middle, and a full-screen button (the preview alone fills the screen; Esc or
// the button again brings it back). Each tool is off until asked for; the bar shows only while one is.
import "./app-ui.css";
import { signal, computed, effect, untrack, onCleanup, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import tr from "../dock-layout/tr.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ThemeToggle, loadTheme, colorTheme, type ThemeMode } from "../../../ui/theme.ts";
import { AccentPicker } from "../../../ui/accent.ts";
import { ThemeMenu } from "../theme-menu/index.ts";
import { Joined } from "../../layout/joined/index.ts";
import { Menu } from "../../actions/menu/index.ts";
import { Button } from "../../actions/button/index.ts";
import { Popover } from "../../overlays/popover/index.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { DevicePreview } from "../../layout/device-preview/index.ts";
import { DEVICES, deviceById, type DeviceSpec } from "../../layout/device-preview/devices.ts";
import { DevicePicker } from "../../layout/device-picker/index.ts";
import { NetworkThrottle, throttleLabel } from "../network-throttle/index.ts";
import { onThrottle, getThrottle, throttled, installThrottle, setThrottleScope } from "../network-throttle/engine.ts";
import type { CallScope } from "../../../ui/call-scope.ts";
import { globe } from "../../../icons/glyphs/globe.ts";
import { phone } from "../../../icons/glyphs/phone.ts";
import { monitor } from "../../../icons/glyphs/monitor.ts";
import { gauge } from "../../../icons/glyphs/gauge.ts";
import { defineIcon } from "../../../icons/svg.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

messages("tr", tr);
messages("tr", { "Full screen": "Tam ekran", "Exit full screen": "Tam ekrandan çık", "Default language": "Varsayılan Dil",
  "Screen size": "Ekran boyutu", "Fit": "Sığdır", "Device": "Cihaz", "Network speed": "Ağ hızı" });
// full screen's own pair (screen corners opening out / closing in), unlike the panels' maximize arrows
const enterFull = defineIcon("fullscreen", ["M3 8V5a2 2 0 0 1 2-2h3", "M16 3h3a2 2 0 0 1 2 2v3", "M21 16v3a2 2 0 0 1-2 2h-3", "M8 21H5a2 2 0 0 1-2-2v-3"]);
const exitFull = defineIcon("fullscreen-exit", ["M8 3v3a2 2 0 0 1-2 2H3", "M21 8h-3a2 2 0 0 1-2-2V3", "M3 16h3a2 2 0 0 1 2 2v3", "M16 21v-3a2 2 0 0 1 2-2h3"]);

/**
 * The tools of the preview toolbar to show: each is off unless named (a tool added later stays hidden until asked
 * for); true: every tool. The bar itself shows only while at least one of them (or your `tools`) does.
 */
export type AppPreviewToolbar = boolean | { theme?: boolean; accent?: boolean; mode?: boolean; language?: boolean; fullscreen?: boolean; device?: boolean; network?: boolean };
/** A device the device tool offers (DevicePreview's DeviceSpec). */
export type AppPreviewDevice = DeviceSpec;
/** The device tool's devices by default: the whole DevicePreview catalog (and your own devices). */
export const PREVIEW_DEVICES: readonly DeviceSpec[] = Object.values(DEVICES);
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
  /** The device the stage shows ("" fills the panel; a device id: DevicePreview's catalog or your own); with `rotate`, turned sideways. @tr Sahnenin gösterdiği cihaz ("" paneli doldurur; bir cihaz kimliği: DevicePreview kataloğu ya da kendi cihazın); `rotate` ile yan çevrilmiş. */
  device?: Signal<string> | undefined;
  /** The device turned sideways (its width and height swapped). @tr Cihaz yan çevrilmiş (genişliği ve yüksekliği yer değiştirir). */
  rotate?: Signal<boolean> | undefined;
  /** The devices the device tool offers (default: the catalog and your own devices). @tr Cihaz aracının sunduğu cihazlar (varsayılan: katalog ve kendi cihazların). */
  devices?: MaybeFn<readonly AppPreviewDevice[] | undefined>;
  /** The code that is the preview, when it shares the page with it: device values (navigator.onLine…) and the network speed apply to its calls only (default: every call). @tr Önizleme olan kod, sayfayı onunla paylaşırken: cihaz değerleri (navigator.onLine…) ve ağ hızı yalnız onun çağrılarına uygulanır (varsayılan: her çağrı). */
  scope?: CallScope | undefined;
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
  /** The chosen device, or undefined: the stage fills the panel. */
  const spec = (): DeviceSpec | undefined => (device() ? val(props.devices)?.find((x) => x.id === device()) ?? deviceById(device()) : undefined);
  const hasDevice = computed(() => !!spec());
  const on = (k: "theme" | "accent" | "mode" | "language" | "fullscreen" | "device" | "network"): boolean => { const b = val(props.toolbar); return b === true || (typeof b === "object" && b[k] === true); };
  const anything = (): boolean => props.tools != null || on("theme") || on("accent") || on("mode") || on("language") || on("fullscreen") || on("device") || on("network");
  // the network now (the throttle's state is the page's: one for every preview); while the tool is there the page's
  // fetch / XHR stay wrapped (the chosen speed holds with the panel closed) and only the preview's calls are slowed
  if (untrack(() => on("network"))) { setThrottleScope(props.scope ?? null); const off = installThrottle(); onCleanup(() => { off(); setThrottleScope(null); }); }
  const net = signal(throttleLabel()), netOn = signal(throttled());
  onCleanup(onThrottle(() => { net.set(throttleLabel()); netOn.set(throttled(getThrottle())); }));
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
    () => (on("device") ? untrack(() => h(Popover, { placement: "bottom-end", label: () => t`Device`, class: "m-app-pv-device", panelClass: "m-app-pv-device-panel",
      trigger: h(Button, { size: "sm", variant: "ghost", "aria-label": () => `${t`Screen size`}: ${spec()?.name ?? t`Fit`}` },
        h("span", { class: "m-app-pv-lang-icon", "aria-hidden": "true" }, () => icon(spec() && (spec()!.kind ?? "phone") === "phone" ? phone : monitor)),
        h("span", {}, () => spec()?.name ?? t`Fit`)),
      children: () => h(DevicePicker, { value: device, landscape: rotate, fit: true, devices: () => val(props.devices) }) })) : null),
    () => (on("network") ? untrack(() => h(Popover, { placement: "bottom-end", label: () => t`Network speed`, title: () => t`Network speed`, class: "m-app-pv-net",
      trigger: h(Button, { size: "sm", variant: "ghost", class: () => cx("m-app-pv-net-btn", netOn() && "is-on"), "aria-label": () => `${t`Network speed`}: ${net()}` },
        h("span", { class: "m-app-pv-lang-icon", "aria-hidden": "true" }, icon(gauge)), h("span", {}, net),
        () => (netOn() ? untrack(() => h(StatusDot, { size: "xs", tone: () => (getThrottle().offline ? "danger" : "warn"), pulse: true })) : null)),
      children: () => h(NetworkThrottle, { scope: props.scope }) })) : null),
    () => (on("theme") ? untrack(() => ThemeMenu({ current: true, page: true, size: "sm", view: "cards", modes: false, accents: false, headings: false, label: () => t`Preview theme`, placement: "bottom-end", value: theme, mode, onChange: (id: string) => theme.set(id) })) : null),
    () => (on("accent") ? untrack(() => AccentPicker({ label: () => t`Preview accent`, placement: "bottom-end", value: accent, theme: () => theme() || colorTheme(), mode: look, onChange: (c: ColorToken) => accent.set(c) })) : null),
    () => (on("mode") ? untrack(() => h(ThemeToggle, { value: mode, onChange: (m: ThemeMode) => mode.set(m) })) : null),
    () => (on("fullscreen") ? untrack(() => h(IconButton, { size: "sm", variant: "ghost", class: "m-app-pv-full", icon: () => (full() ? exitFull : enterFull), pressed: full, label: () => (full() ? t`Exit full screen` : t`Full screen`), onClick: toggleFull })) : null)));
  // the stage is drawn in the chosen theme (its stylesheet loads when it is chosen) and mode; the accent on an inner box
  effect(() => { if (theme()) void loadTheme(theme()); });
  // a device: the content in DevicePreview (a phone, a tablet or a desktop window at its real size, fitted to the stage,
  // with its control rail); without one, the content fills the stage
  const content = h("div", { class: "m-app-pv-accent", "data-m-accent": () => (accent() === "primary" ? null : accent()) }, props.children);
  const stage = h("div", { class: () => cx("m-app-pv-stage", hasDevice() && "is-device"), "data-m-theme": () => theme() || null, "data-theme": look },
    () => (hasDevice() ? untrack(() => h(DevicePreview, { device: () => spec() ?? DEVICES["iphone-15"]!, landscape: rotate, controls: true, fit: "contain", scope: props.scope }, content)) : content));
  // one piece (Joined): the bar, the stage and the footer read as header, body and footer; what the footer holds (a code
  // view) loses its own frame and corners too
  root = h(Joined, { class: () => cx("m-app-pv", full() && "is-full", cover() && "is-cover", barShown() && "is-bar-shown", val(props.class)), radius: 0, border: false, onPointermove: onMove },
    bar, stage, props.footer != null ? h(Joined, { class: "m-app-pv-foot", radius: 0, border: false }, props.footer) : null) as HTMLElement;
  return root;
}
