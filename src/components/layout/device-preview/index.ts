// DevicePreview (march/layout): shows content as on a real device — a phone or tablet body with its notch or camera,
// status bar and home indicator, or a desktop browser window — at the real screen size, portrait or landscape (it
// turns with a motion). On a touch screen the mouse becomes one to three fingers: real touch and pointer events, drag to
// scroll with a fling, long press, Shift + drag to pinch and rotate, gestures played by themselves. Its control rail
// (`controls`) plays what a real device feels and tells: shake (devicemotion), tilt (deviceorientation), offline,
// battery, background (visibilitychange), the on-screen keyboard. The screen is an <OverlayScope> (drawers and dialogs
// open inside it) and the m-site container (blocks answer to its width), so a site in it behaves as on the device.
//
//   <DevicePreview device="iphone-15" landscape={$land} controls><MySite /></DevicePreview>
//   <DevicePreview device={{ name: "Kiosk", width: 1080, height: 1920, radius: 0 }}>…</DevicePreview>
import "./device-preview.css";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { signal, onCleanup, effect, untrack, type Signal } from "../../../core/reactive.ts";
import { cx, val, icon, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { OverlayScope } from "../overlay-scope/index.ts";
import { animateEl } from "../../../motion/env.ts";
import { observeSize } from "../../../ui/observe.ts";
import { defineIcon } from "../../../icons/svg.ts";
import { rotateCw } from "../../../icons/glyphs/rotateCw.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";
import { compass } from "../../../icons/glyphs/compass.ts";
import { eyeOff } from "../../../icons/glyphs/eyeOff.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Button } from "../../actions/button/index.ts";
import { Menu } from "../../actions/menu/index.ts";
import { Popover } from "../../overlays/popover/index.ts";
import { Slider } from "../../forms/slider/index.ts";
import { Toggle } from "../../forms/toggle/index.ts";
import type { CallScope } from "../../../ui/call-scope.ts";
import { DEVICES, deviceById, isTouch, dprOf, type DeviceSpec } from "./devices.ts";
import { deviceSensors, type DeviceSensors, type Battery, type Tilt } from "./sensors.ts";
import { touchSim, type Gesture, type TouchSim } from "./touch.ts";

export { DEVICES, customDevices, addDevice, removeDevice, allDevices, deviceById, type DeviceSpec, type DeviceKind } from "./devices.ts";
export { deviceSensors, type DeviceSensors, type Battery, type Tilt, type SensorOptions } from "./sensors.ts";
export { touchSim, GESTURES, type Gesture, type TouchSim, type TouchSimOptions } from "./touch.ts";

messages("tr", {
  "Device controls": "Cihaz kumandası", "Turn to landscape": "Yatay çevir", "Turn to portrait": "Dikey çevir", "Fingers: {0}": "Parmak: {0}",
  "Gestures": "Hareketler", "Shake": "Salla", "Tilt": "Eğ", "Hold it flat": "Düz tut", "Go offline": "Çevrimdışı ol", "Go online": "Çevrimiçi ol",
  "Battery": "Pil", "Charging": "Şarj oluyor", "Send to background": "Arka plana al", "Bring back": "Geri getir", "Keyboard": "Klavye",
  "In the background": "Arka planda", "Tap to come back": "Dönmek için dokun", "{0} preview": "{0} önizlemesi",
  "Tap": "Dokun", "Double tap": "Çift dokun", "Long press": "Uzun bas", "Swipe left": "Sola kaydır", "Swipe right": "Sağa kaydır", "Swipe up": "Yukarı kaydır", "Swipe down": "Aşağı kaydır",
  "Pinch in": "Kıstır (uzaklaş)", "Pinch out": "Aç (yakınlaş)", "Rotate": "Döndür", "Two-finger scroll": "İki parmakla kaydır",
  "Three-finger swipe left": "Üç parmakla sola", "Three-finger swipe right": "Üç parmakla sağa", "Three-finger swipe up": "Üç parmakla yukarı",
  "Turn (alpha)": "Döndür (alfa)", "Forward / back (beta)": "İleri / geri (beta)", "Left / right (gamma)": "Sola / sağa (gama)", "Level": "Doluluk",
});

// the rail's own glyphs (24-grid strokes, as March's icons)
const hand = defineIcon("hand", ["M18 11V6a2 2 0 0 0-4 0", "M14 10V4a2 2 0 0 0-4 0v2", "M10 10.5V6a2 2 0 0 0-4 0v8", "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"]);
const vibrate = defineIcon("vibrate", ["b:8,4,8,16,2", "M2 8v8", "M22 8v8", "M5 10v4", "M19 10v4"]);
const wifi = defineIcon("wifi", ["M12 20h.01", "M2 8.82a15 15 0 0 1 20 0", "M5 12.86a10 10 0 0 1 14 0", "M8.5 16.43a5 5 0 0 1 7 0"]);
const wifiOff = defineIcon("wifi-off", ["M12 20h.01", "M8.5 16.43a5 5 0 0 1 7 0", "M5 12.86a10 10 0 0 1 5.17-2.69", "M19 12.86a10 10 0 0 0-2-1.5", "M2 8.82a15 15 0 0 1 4.18-2.65", "M22 8.82a15 15 0 0 0-11.29-3.76", "M2 2l20 20"]);
const batteryIcon = defineIcon("battery", ["b:2,7,16,10,2", "M22 11v2", "M6 10v4", "M10 10v4"]);
const keyboardIcon = defineIcon("keyboard", ["b:2,5,20,14,2", "M6 9h.01", "M10 9h.01", "M14 9h.01", "M18 9h.01", "M6 13h.01", "M18 13h.01", "M10 13h4", "M8 16h8"]);

/** What the code (or your controls) can do with the device. */
export interface DeviceApi {
  /** Play a gesture with the fingers (around the middle of the screen). */
  play(g: Gesture): Promise<void>;
  /** Shake the device (devicemotion). */
  shake(): void;
  /** The device's events and values (offline, battery, background, tilt). */
  sensors(): DeviceSensors | null;
}

export interface DevicePreviewProps {
  /** The device: a catalog id (default "iphone-15"; see DEVICES, and your own devices) or your own `DeviceSpec`. @tr Cihaz: katalogdan bir kimlik (varsayılan "iphone-15"; bkz. DEVICES ve kendi cihazların) ya da kendi `DeviceSpec` nesnen. */
  device?: MaybeFn<string | DeviceSpec>;
  /** Turns the device sideways (a signal: the control rail can turn it too). @tr Cihazı yan çevirir (bir sinyal verilirse kumanda da çevirebilir). */
  landscape?: Signal<boolean> | MaybeFn<boolean | undefined>;
  /** Mouse acts as fingers (touch dot, real touch events, drag to scroll, fling, long press). Default: the device's (phones and tablets). @tr Fare parmak gibi davranır (dokunma izi, gerçek dokunma olayları, sürükleyerek kaydırma, fırlatma, uzun basma). Varsayılan: cihazınki (telefon ve tablet). */
  touch?: MaybeFn<boolean | undefined>;
  /** Scale down to fit its place: true (default: its width and a sensible height), "contain" (its width and height) or false. @tr Bulunduğu yere sığacak kadar küçülür: true (varsayılan: genişliği ve makul bir yükseklik), "contain" (genişliği ve yüksekliği) ya da false. */
  fit?: boolean | "contain";
  /** The most height the fitted device may take, in px (default: the window's height − 160, at least 480). @tr Sığdırılan cihazın alabileceği en büyük yükseklik, px (varsayılan: pencere yüksekliği − 160, en az 480). */
  fitHeight?: MaybeFn<number | undefined>;
  /** Show this address in the device (an iframe: real viewport, real scrolling, real media queries) instead of children. @tr Alt öğeler yerine bu adresi cihazda gösterir (bir iframe: gerçek görüntü alanı, gerçek kaydırma, gerçek medya sorguları). */
  src?: MaybeFn<string | undefined>;
  /** Accessible name of the device (default "<device> preview"). @tr Cihazın erişilebilir adı (varsayılan "<cihaz> önizlemesi"). */
  label?: MaybeFn<string | undefined>;
  /** The status bar: true (default), false, or your own node in its place. @tr Durum çubuğu: true (varsayılan), false ya da yerine kendi düğümün. */
  statusBar?: MaybeFn<boolean | undefined> | Node;
  /** The clock text of the status bar (default: the time now), e.g. "9:41". @tr Durum çubuğundaki saat metni (varsayılan: şimdiki saat), ör. "9:41". */
  time?: MaybeFn<string | undefined>;
  /** The home indicator line (default true). @tr Ana ekran göstergesi çizgisi (varsayılan true). */
  homeIndicator?: MaybeFn<boolean | undefined>;
  /** false hides the camera (island, punch hole or notch) of the device (default true). @tr false cihazın kamerasını (ada, delik ya da çentik) gizler (varsayılan true). */
  camera?: MaybeFn<boolean | undefined>;
  /** The control rail beside the device: turn, fingers, gestures, shake, tilt, offline, battery, background, keyboard (default false). @tr Cihazın yanındaki kumanda: çevir, parmaklar, hareketler, salla, eğ, çevrimdışı, pil, arka plan, klavye (varsayılan false). */
  controls?: MaybeFn<boolean | undefined>;
  /** How many fingers a drag uses, 1–3 (a signal: the rail changes it). @tr Bir sürüklemenin kaç parmakla yapıldığı, 1–3 (bir sinyal: kumanda değiştirir). */
  fingers?: Signal<number> | undefined;
  /** The on-screen keyboard: "auto" (default: it opens when a field gets focus on a touch device), true or false. @tr Ekran klavyesi: "auto" (varsayılan: dokunmatik cihazda bir alan odak alınca açılır), true ya da false. */
  keyboard?: MaybeFn<boolean | "auto" | undefined>;
  /** The events the device fires, shown for a moment under it (default: with `controls`). @tr Cihazın attığı olaylar bir an altında görünür (varsayılan: `controls` ile). */
  events?: MaybeFn<boolean | undefined>;
  /** The address shown in a desktop window's bar (default the page's host). @tr Masaüstü penceresinin adres çubuğundaki metin (varsayılan sayfanın adresi). */
  address?: MaybeFn<string | undefined>;
  /** Whose calls see the device's values (navigator.onLine, document.hidden, devicePixelRatio…) when it shares the page with them (no `src`); default every call. @tr Cihazın değerlerini (navigator.onLine, document.hidden, devicePixelRatio…) kimin çağrıları görür, sayfayı onlarla paylaşırken (`src` yok); varsayılan her çağrı. */
  scope?: CallScope | undefined;
  /** Called with each device event fired (its name and a short detail). @tr Atılan her cihaz olayıyla çağrılır (adı ve kısa bir ayrıntı). */
  onEvent?: ((name: string, detail?: string) => void) | undefined;
  /** Receives the device's API (play a gesture, shake, its sensors). @tr Cihazın API'sini alır (hareket oynat, salla, algılayıcıları). */
  ref?: ((api: DeviceApi) => void) | undefined;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
  /** The page shown inside the screen (when there is no `src`). @tr Ekranın içinde gösterilen sayfa (`src` yokken). */
  children?: unknown;
}

const now = (): string => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
const isSignal = <T>(v: unknown): v is Signal<T> => typeof v === "function" && typeof (v as { set?: unknown }).set === "function";
const isField = (el: Element | null | undefined): el is HTMLInputElement | HTMLTextAreaElement =>
  !!el && ((el.tagName === "INPUT" && !/^(button|checkbox|radio|range|color|file|submit|reset|image|hidden)$/i.test((el as HTMLInputElement).type)) || el.tagName === "TEXTAREA");

/** A same-origin page in a frame (h() never creates <iframe>: only pages of this site, never another origin). */
export function previewFrame(src: MaybeFn<string | undefined>, title: MaybeFn<string>, cls: string): HTMLIFrameElement {
  const f = document.createElement("iframe");
  f.className = cls;
  effect(() => {
    const raw = val(src);
    let u = "about:blank";
    try { const r = new URL(raw ?? "", location.href); if (raw && r.origin === location.origin) u = r.href; } catch { /* stays blank */ }
    if (f.getAttribute("src") !== u) f.setAttribute("src", u);
    f.title = val(title);
  });
  return f;
}

// the on-screen keyboard's rows (Turkish Q; the second page: digits and signs)
const KEYS = [["qwertyuıopğü", "asdfghjklşi", "zxcvbnmöç"], ["1234567890", "-/:;()₺&@\"", ".,?!'"]];

/** Content shown as on a phone, a tablet or a desktop window, with touch and device events. */
export function DevicePreview(props: DevicePreviewProps): Element {
  const time = signal(now());
  const tick = setInterval(() => time.set(now()), 30_000);
  onCleanup(() => clearInterval(tick));
  const scale = signal(1);

  const spec = (): DeviceSpec => { const d = val(props.device); return (typeof d === "object" ? d : deviceById(d ?? "iphone-15")) ?? DEVICES["iphone-15"]!; };
  const kind = (): string => spec().kind ?? "phone";
  const desk = (): boolean => kind() === "desktop";
  const landRaw = props.landscape;
  const landSig: Signal<boolean> = isSignal<boolean>(landRaw) ? landRaw : signal(!!untrack(() => val(landRaw as MaybeFn<boolean | undefined>)));
  if (!isSignal(landRaw)) effect(() => landSig.set(!!val(landRaw as MaybeFn<boolean | undefined>)));
  const land = (): boolean => landSig();
  const touchOn = (): boolean => val(props.touch) ?? isTouch(spec());
  const fingers = props.fingers ?? signal(1);
  const label = (): string => val(props.label) ?? t`${spec().name} preview`;
  const ctrl = (): boolean => !!val(props.controls);

  // the device's state (kept across the pages a frame loads)
  const st = { online: signal(true), battery: signal<Battery>({ level: 0.82, charging: false }), hidden: signal(false), tilt: signal<Tilt>({ alpha: 0, beta: 0, gamma: 0 }) };
  const kbManual = signal<boolean | null>(null), fieldFocused = signal(false);
  const kbShown = (): boolean => { if (desk()) return false; const m = kbManual(); if (m != null) return m; const k = val(props.keyboard) ?? "auto"; return k === true || (k === "auto" && touchOn() && fieldFocused()); };
  // the event ticker
  let seq = 0;
  const log = signal<{ id: number; name: string; detail?: string | undefined }[]>([]);
  const say = (name: string, detail?: string): void => {
    props.onEvent?.(name, detail);
    const id = ++seq;
    log.set([...log.peek().slice(-3), { id, name, detail }]);
    setTimeout(() => log.set(log.peek().filter((x) => x.id !== id)), 2600);
  };

  const frame = props.src != null ? previewFrame(props.src, label, "m-device-frame") : null;
  const sb = props.statusBar, ownBar = sb != null && typeof sb === "object";
  const viewport = h("div", { class: () => cx("m-device-viewport", frame && "is-framed") }, frame ?? props.children) as HTMLElement;
  const dot = h("div", { class: "m-device-touch", "aria-hidden": "true" }) as HTMLElement;
  const docOf = (): Document => frame?.contentDocument ?? document;
  const focused = (): HTMLInputElement | HTMLTextAreaElement | null => { const a = docOf().activeElement; return isField(a) && (frame ? true : viewport.contains(a)) ? a : null; };

  // the keyboard: typing into the focused field (the field keeps its focus)
  const kbPage = signal(0), shift = signal(false);
  const type = (k: string): void => {
    const el = focused();
    if (!el) return;
    const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s;
    const view = el.ownerDocument.defaultView as Window & typeof globalThis;
    const input = (inputType: string, data: string | null): void => { el.dispatchEvent(new view.InputEvent("input", { bubbles: true, inputType, data })); };
    if (k === "⌫") { const from = s === e ? Math.max(0, s - 1) : s; el.setRangeText("", from, e, "end"); input("deleteContentBackward", null); return; }
    if (k === "↵") {
      const ev = new view.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      if (!el.dispatchEvent(ev)) return;
      if (el.tagName === "TEXTAREA") { el.setRangeText("\n", s, e, "end"); input("insertLineBreak", null); } else el.form?.requestSubmit?.();
      return;
    }
    const ch = shift.peek() ? k.toLocaleUpperCase("tr") : k;
    el.setRangeText(ch, s, e, "end"); input("insertText", ch);
    if (shift.peek()) shift.set(false);
  };
  const key = (k: string, cls = "", lbl?: unknown): Element => h("span", { class: cx("m-device-key", cls), "data-key": k, role: "button", "aria-label": k === " " ? "space" : k }, lbl ?? (() => (shift() ? k.toLocaleUpperCase("tr") : k)));
  const keyboard = h("div", { class: "m-device-kb", "aria-hidden": "true", hidden: () => !kbShown(),
    onMousedown: (e: MouseEvent) => e.preventDefault(), onPointerdown: (e: PointerEvent) => e.preventDefault(),
    onClick: (e: MouseEvent) => {
      const k = (e.target as Element).closest?.("[data-key]")?.getAttribute("data-key");
      if (k == null) return;
      if (k === "⇧") shift.set(!shift.peek()); else if (k === "123") { kbPage.set(1 - kbPage.peek()); } else type(k);
    } },
    () => { const rows = KEYS[kbPage()]!; return [
      h("div", { class: "m-device-kb-row" }, [...rows[0]!].map((k) => key(k))),
      h("div", { class: "m-device-kb-row" }, [...rows[1]!].map((k) => key(k))),
      h("div", { class: "m-device-kb-row" }, key("⇧", "is-wide is-fn", "⇧"), [...rows[2]!].map((k) => key(k)), key("⌫", "is-wide is-fn", "⌫")),
      h("div", { class: "m-device-kb-row" }, key("123", "is-wide is-fn", () => (kbPage() ? "ABC" : "123")), key(" ", "is-space", ""), key("↵", "is-wide is-go", "↵")),
    ]; }) as HTMLElement;

  // background: the app steps back
  const away = h("div", { class: "m-device-away", hidden: () => !st.hidden(), onClick: () => st.hidden.set(false) },
    h("strong", {}, () => t`In the background`), h("span", {}, () => t`Tap to come back`)) as HTMLElement;
  const battery = (): string => `${Math.round(st.battery().level * 100)}%`;
  const statusBar = ownBar ? h("div", { class: "m-device-status is-own" }, sb)
    : h("div", { class: "m-device-status", "aria-hidden": "true", hidden: () => desk() || val(sb as MaybeFn<boolean | undefined>) === false },
      h("span", { class: "m-device-time" }, () => val(props.time) ?? time()),
      h("span", { class: "m-device-icons" }, h("i", { class: "m-device-signal" }), h("i", { class: () => cx("m-device-wifi", !st.online() && "is-off") }),
        h("i", { class: () => cx("m-device-battery", st.battery().charging && "is-charging", st.battery().level < 0.2 && "is-low"), style: () => ({ "--m-dev-bat": battery() }), title: battery })));
  const bar = h("div", { class: "m-device-bar", "aria-hidden": "true", hidden: () => !desk() },
    h("span", { class: "m-device-lights" }, h("i", {}), h("i", {}), h("i", {})),
    h("span", { class: "m-device-address" }, () => val(props.address) ?? (globalThis.location?.host || "localhost")),
    h("span", { class: "m-device-size" }, () => { const s = spec(); return land() ? `${s.height} × ${s.width}` : `${s.width} × ${s.height}`; }));
  const screen = h(OverlayScope, { class: "m-device-screen", children: [
    bar, statusBar, viewport, keyboard,
    h("div", { class: "m-device-home", "aria-hidden": "true", hidden: () => desk() || val(props.homeIndicator) === false || kbShown() }),
    away, dot,
  ] }) as HTMLElement;
  const body = h("div", {
    class: () => cx("m-device", `m-device-${kind()}`, `m-device-cam-${val(props.camera) === false ? "none" : spec().camera ?? "none"}`, land() && "is-landscape", touchOn() && "is-touch", kbShown() && "has-kb", val(props.class)),
    role: "group", "aria-label": label,
    style: () => {
      const s = spec(), w = land() ? s.height : s.width, hh = land() ? s.width : s.height, tl = st.tilt();
      return { "--m-dev-w": `${w}px`, "--m-dev-h": `${hh}px`, "--m-dev-r": `${s.radius ?? 24}px`, "--m-dev-scale": String(scale()),
        "--m-dev-rx": `${(-tl.beta * 0.3).toFixed(1)}deg`, "--m-dev-ry": `${(tl.gamma * 0.3).toFixed(1)}deg` };
    },
  }, h("div", { class: "m-device-camera", "aria-hidden": "true" }), screen) as HTMLElement;

  // ---- fingers
  let sim: TouchSim | null = null;
  const k = (): number => scale() || 1;
  const simOn = (): boolean => touchOn() && !st.hidden();
  const common = { layer: screen, on: simOn, fingers: () => fingers(), onPress: (d: boolean) => { screen.classList.toggle("is-pressed", d); }, onGesture: (g: string) => say("touch", g) };
  const hover = (p: { x: number; y: number }): void => { dot.style.translate = `${p.x}px ${p.y}px`; };
  if (frame) {
    let unbind: (() => void) | undefined;
    const attach = (): void => {
      unbind?.();
      const doc = frame.contentDocument;
      if (!doc) return;
      const st2 = doc.createElement("style");
      st2.textContent = "html.m-touch-sim, html.m-touch-sim * { cursor: none !important; } html.m-touch-sim { -webkit-user-select: none; user-select: none; } html.m-touch-sim :is(input, textarea, select, [contenteditable=true]) { user-select: text; } html.m-touch-sim ::-webkit-scrollbar { display: none; } html.m-touch-sim { scrollbar-width: none; }";
      doc.head?.appendChild(st2);
      const cls = effect(() => doc.documentElement.classList.toggle("m-touch-sim", simOn()));
      const toLayer = (x: number, y: number): { x: number; y: number } => ({ x: x + viewport.offsetLeft + frame.offsetLeft, y: y + viewport.offsetTop + frame.offsetTop });
      const s = touchSim({ ...common, surface: doc, toLayer, fromLayer: (x, y) => ({ x: x - viewport.offsetLeft - frame.offsetLeft, y: y - viewport.offsetTop - frame.offsetTop }),
        root: () => (doc.scrollingElement ?? doc.documentElement) as HTMLElement, onHover: (x, y) => hover(toLayer(x, y)) });
      sim = s;
      const sensors = deviceSensors(frame.contentWindow as Window & typeof globalThis, { dpr: () => dprOf(spec()), landscape: land, onEvent: say, state: st });
      sens = sensors;
      const fin = (e: FocusEvent): void => { fieldFocused.set(isField(e.target as Element)); };
      const fout = (): void => { setTimeout(() => fieldFocused.set(isField(doc.activeElement)), 0); };
      doc.addEventListener("focusin", fin); doc.addEventListener("focusout", fout);
      unbind = () => { s.dispose(); sensors.dispose(); cls(); doc.removeEventListener("focusin", fin); doc.removeEventListener("focusout", fout); };
    };
    frame.addEventListener("load", attach);
    onCleanup(() => unbind?.());
  } else {
    const r = (): DOMRect => screen.getBoundingClientRect();
    const toLayer = (x: number, y: number): { x: number; y: number } => { const b = r(); return { x: (x - b.left) / k(), y: (y - b.top) / k() }; };
    sim = touchSim({ ...common, surface: viewport, toLayer, fromLayer: (x, y) => { const b = r(); return { x: b.left + x * k(), y: b.top + y * k() }; }, root: () => viewport, onHover: (x, y) => hover(toLayer(x, y)) });
    onCleanup(() => sim?.dispose());
    viewport.addEventListener("focusin", (e) => fieldFocused.set(isField(e.target as Element)));
    viewport.addEventListener("focusout", () => { setTimeout(() => fieldFocused.set(isField(document.activeElement) && viewport.contains(document.activeElement)), 0); });
  }
  screen.addEventListener("pointerenter", () => screen.classList.add("is-over"));
  screen.addEventListener("pointerleave", () => screen.classList.remove("is-over"));

  // ---- device events
  let sens: DeviceSensors | null = frame ? null : deviceSensors(window as Window & typeof globalThis, { scope: props.scope, dpr: () => dprOf(spec()), landscape: land, onEvent: say, state: st });
  onCleanup(() => sens?.dispose());
  const shake = (): void => {
    sens?.shake();
    animateEl(body, [{ translate: "0 0" }, { translate: "-14px 0", rotate: "-2deg" }, { translate: "12px 0", rotate: "2deg" }, { translate: "-9px 0", rotate: "-1.5deg" }, { translate: "7px 0", rotate: "1deg" }, { translate: "-3px 0" }, { translate: "0 0" }], { duration: 620, easing: "ease-out" });
  };
  // turning: the layout swaps at once, the body turns into it
  let firstTurn = true;
  effect(() => {
    const l = land();
    if (firstTurn) { firstTurn = false; return; }
    untrack(() => {
      sens?.orient(l);
      animateEl(body, [{ rotate: l ? "-90deg" : "90deg", scale: "0.9" }, { rotate: "0deg", scale: "1" }], { duration: 560, easing: "cubic-bezier(.2,.9,.25,1.05)" });
    });
  });
  props.ref?.({ play: (g) => sim?.play(g) ?? Promise.resolve(), shake, sensors: () => sens });

  // ---- the control rail
  const gestures: [Gesture, () => string][] = [["tap", () => t`Tap`], ["double-tap", () => t`Double tap`], ["long-press", () => t`Long press`], ["swipe-left", () => t`Swipe left`], ["swipe-right", () => t`Swipe right`],
    ["swipe-up", () => t`Swipe up`], ["swipe-down", () => t`Swipe down`], ["pinch-in", () => t`Pinch in`], ["pinch-out", () => t`Pinch out`], ["rotate", () => t`Rotate`], ["pan-2", () => t`Two-finger scroll`],
    ["swipe-3-left", () => t`Three-finger swipe left`], ["swipe-3-right", () => t`Three-finger swipe right`], ["swipe-3-up", () => t`Three-finger swipe up`]];
  const btn = (ic: unknown, lbl: () => string, onClick: () => void, pressed?: () => boolean, hidden?: () => boolean): unknown =>
    () => (hidden?.() ? null : untrack(() => h(IconButton, { icon: ic, label: lbl, size: "sm", variant: "ghost", pressed, onClick })));
  const tiltRow = (lbl: () => string, k2: keyof Tilt, min: number, max: number): Element => h("div", { class: "m-device-pop-row" },
    h("span", {}, lbl), h(Slider, { min, max, step: 1, showValue: true, "aria-label": untrack(lbl), get value() { return st.tilt()[k2]; }, onChange: (v: number) => st.tilt.set({ ...st.tilt.peek(), [k2]: v }), format: (v: number) => `${v}°` }));
  const rail = h("div", { class: "m-device-rail", role: "toolbar", "aria-label": () => t`Device controls`, "aria-orientation": "vertical", hidden: () => !ctrl() },
    btn(rotateCw, () => (land() ? t`Turn to portrait` : t`Turn to landscape`), () => landSig.set(!landSig.peek())),
    () => (touchOn() ? untrack(() => h(IconButton, { icon: hand, size: "sm", variant: "ghost", class: "m-device-fingers", label: () => t`Fingers: ${fingers()}`, pressed: () => fingers() > 1,
      onClick: () => fingers.set((fingers.peek() % 3) + 1) }, h("b", { class: "m-device-count", "aria-hidden": "true" }, () => String(fingers())))) : null),
    () => (touchOn() ? untrack(() => h(Menu, { icon: sparkles, label: () => t`Gestures`, size: "sm", variant: "ghost", placement: "bottom-end",
      items: () => gestures.map(([g, l]) => ({ label: l(), onSelect: () => { void sim?.play(g); } })) })) : null),
    btn(vibrate, () => t`Shake`, shake, undefined, desk),
    () => (desk() ? null : untrack(() => h(Popover, { placement: "bottom-end", title: () => t`Tilt`, width: "sm",
      trigger: h(IconButton, { icon: compass, size: "sm", variant: "ghost", label: () => t`Tilt`, pressed: () => { const x = st.tilt(); return !!(x.alpha || x.beta || x.gamma); } }),
      children: () => h("div", { class: "m-device-pop" },
        tiltRow(() => t`Forward / back (beta)`, "beta", -90, 90), tiltRow(() => t`Left / right (gamma)`, "gamma", -90, 90), tiltRow(() => t`Turn (alpha)`, "alpha", 0, 360),
        h(Button, { size: "sm", variant: "ghost", onClick: () => st.tilt.set({ alpha: 0, beta: 0, gamma: 0 }) }, () => t`Hold it flat`)) }))),
    btn(() => (st.online() ? wifi : wifiOff), () => (st.online() ? t`Go offline` : t`Go online`), () => st.online.set(!st.online.peek()), () => !st.online()),
    () => untrack(() => h(Popover, { placement: "bottom-end", title: () => t`Battery`, width: "sm",
      trigger: h(IconButton, { icon: batteryIcon, size: "sm", variant: "ghost", label: () => `${t`Battery`} · ${battery()}` }),
      children: () => h("div", { class: "m-device-pop" },
        h("div", { class: "m-device-pop-row" }, h("span", {}, () => t`Level`), h(Slider, { min: 0, max: 100, step: 1, showValue: true, "aria-label": t`Level`, get value() { return Math.round(st.battery().level * 100); }, onChange: (v: number) => st.battery.set({ ...st.battery.peek(), level: v / 100 }), format: (v: number) => `${v}%` })),
        h(Toggle, { get value() { return st.battery().charging; }, onChange: (v: boolean | null) => st.battery.set({ ...st.battery.peek(), charging: !!v }), label: () => t`Charging` })) })),
    btn(eyeOff, () => (st.hidden() ? t`Bring back` : t`Send to background`), () => st.hidden.set(!st.hidden.peek()), () => st.hidden()),
    btn(keyboardIcon, () => t`Keyboard`, () => kbManual.set(!kbShown()), kbShown, desk),
  ) as HTMLElement;
  const ticker = h("div", { class: "m-device-log", "aria-live": "polite", hidden: () => !(val(props.events) ?? ctrl()) },
    () => log().map((x) => h("span", { class: "m-device-ev", key: x.id }, h("b", {}, x.name), x.detail ? h("span", {}, x.detail) : null)));
  const column = h("div", { class: "m-device-col" }, body, ticker);
  const outer = h("div", { class: () => cx("m-device-stage", props.fit === "contain" && "is-contain", ctrl() && "has-rail") }, column, rail) as HTMLElement;

  // fit: scale the device down to its place
  const extra = (): { x: number; y: number } => (desk() ? { x: 2, y: 40 } : kind() === "tablet" ? { x: 36, y: 36 } : { x: 24, y: 24 });
  const fitNow = (): void => {
    if (props.fit === false || !outer.clientWidth) return; // not laid out (hidden, or no layout engine)
    const s = spec(), w = land() ? s.height : s.width, hh = land() ? s.width : s.height, ex = extra();
    const railW = ctrl() ? (rail.offsetWidth || 44) + 16 : 0;
    const room = outer.clientWidth - 32 - railW;
    const tall = props.fit === "contain" ? outer.clientHeight - 32 - (ctrl() ? 34 : 0) : val(props.fitHeight) ?? Math.max(480, (globalThis.innerHeight ?? 900) - 160);
    scale.set(Math.max(0.1, Math.min(1, room / (w + ex.x), tall / (hh + ex.y))));
  };
  if (props.fit !== false) {
    observeSize(outer, fitNow);
    effect(() => { spec(); land(); ctrl(); untrack(fitNow); });
  }
  return outer;
}
