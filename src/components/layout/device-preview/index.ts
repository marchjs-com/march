// DevicePreview (hadi-march/layout): shows content as on a real phone or tablet — a device body with its notch or
// camera, status bar and home indicator, the real screen size, portrait or landscape — and makes the mouse act like a
// finger: the cursor becomes a touch dot, dragging scrolls (with a fling), a long press opens the context menu, and
// pointer events say "touch". The screen is an <OverlayScope> (drawers and dialogs open inside it) and the hm-site
// container (blocks answer to its width), so a site in it behaves as on the device.
//
//   <DevicePreview device="iphone-15" landscape={false} touch><MySite /></DevicePreview>
//   <DevicePreview device={{ name: "Kiosk", width: 1080, height: 1920, radius: 0 }}>…</DevicePreview>
import "./device-preview.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { signal, onCleanup, effect } from "../../../core/reactive.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { OverlayScope } from "../overlay-scope/index.ts";
import { animateValue } from "../../../motion/engine/value.ts";

export interface DeviceSpec {
  name: string;
  /** CSS pixel size of the screen in portrait. */
  width: number;
  height: number;
  /** Corner radius of the screen (px). */
  radius?: number;
  kind?: "phone" | "tablet" | "screen";
  /** "island" (pill), "punch" (camera hole), "notch" or none. */
  camera?: "island" | "punch" | "notch" | "none";
}

/** Devices by id (screen sizes in CSS pixels). */
export const DEVICES: Record<string, DeviceSpec> = {
  "iphone-15": { name: "iPhone 15", width: 393, height: 852, radius: 55, kind: "phone", camera: "island" },
  "iphone-se": { name: "iPhone SE", width: 375, height: 667, radius: 0, kind: "phone", camera: "none" },
  "pixel-8": { name: "Pixel 8", width: 412, height: 915, radius: 42, kind: "phone", camera: "punch" },
  "galaxy-s24": { name: "Galaxy S24", width: 384, height: 832, radius: 38, kind: "phone", camera: "punch" },
  "ipad": { name: "iPad", width: 820, height: 1180, radius: 22, kind: "tablet", camera: "none" },
  "ipad-pro": { name: "iPad Pro 12.9", width: 1024, height: 1366, radius: 22, kind: "tablet", camera: "none" },
};

export interface DevicePreviewProps {
  device?: MaybeFn<string | DeviceSpec>;
  landscape?: MaybeFn<boolean | undefined>;
  /** Mouse acts as a finger (touch dot, drag to scroll, fling, long press). Default true. */
  touch?: MaybeFn<boolean | undefined>;
  /** Scale down to fit the width of its place (default true). */
  fit?: boolean;
  /** Show this address in the device (an iframe: real viewport, real scrolling, real media queries) instead of children. */
  src?: MaybeFn<string | undefined>;
  /** Accessible name of the device (default "<device> preview"). */
  label?: MaybeFn<string | undefined>;
  /** The status bar: true (default), false, or your own node in its place. */
  statusBar?: MaybeFn<boolean | undefined> | Node;
  /** The clock text of the status bar (default: the time now), e.g. "9:41". */
  time?: MaybeFn<string | undefined>;
  /** The home indicator line (default true). */
  homeIndicator?: MaybeFn<boolean | undefined>;
  /** false hides the camera (island, punch hole or notch) of the device (default true). */
  camera?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
  children?: unknown;
}

const specOf = (d: string | DeviceSpec | undefined): DeviceSpec => (typeof d === "object" ? d : DEVICES[d ?? "iphone-15"] ?? DEVICES["iphone-15"]!);
const now = (): string => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());

/** The nearest element under `el` that can scroll on the given axis. */
function scrollerOf(el: Element | null, stop: Element, axis: "x" | "y"): HTMLElement {
  for (let e = el as HTMLElement | null; e && e !== stop; e = e.parentElement) {
    const s = getComputedStyle(e), o = axis === "y" ? s.overflowY : s.overflowX;
    if (/(auto|scroll)/.test(o) && (axis === "y" ? e.scrollHeight > e.clientHeight : e.scrollWidth > e.clientWidth)) return e;
  }
  return stop as HTMLElement;
}

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

/** Content shown as on a phone or tablet, with touch behavior. */
export function DevicePreview(props: DevicePreviewProps): Element {
  const time = signal(now());
  const tick = setInterval(() => time.set(now()), 30_000);
  onCleanup(() => clearInterval(tick));
  const scale = signal(1);

  const spec = (): DeviceSpec => specOf(val(props.device));
  const land = (): boolean => !!val(props.landscape);
  const label = (): string => val(props.label) ?? t`${spec().name} preview`;
  const frame = props.src != null ? previewFrame(props.src, label, "hm-device-frame") : null;
  const sb = props.statusBar, ownBar = sb != null && typeof sb === "object";
  const viewport = h("div", { class: () => cx("hm-device-viewport", frame && "is-framed") }, frame ?? props.children) as HTMLElement;
  const dot = h("div", { class: "hm-device-touch", "aria-hidden": "true" }) as HTMLElement;
  const screen = h(OverlayScope, { class: "hm-device-screen", children: [
    ownBar ? h("div", { class: "hm-device-status is-own" }, sb)
      : h("div", { class: "hm-device-status", "aria-hidden": "true", hidden: () => val(sb as MaybeFn<boolean | undefined>) === false },
        h("span", { class: "hm-device-time" }, () => val(props.time) ?? time()),
        h("span", { class: "hm-device-icons" }, h("i", { class: "hm-device-signal" }), h("i", { class: "hm-device-wifi" }), h("i", { class: "hm-device-battery" }))),
    viewport,
    h("div", { class: "hm-device-home", "aria-hidden": "true", hidden: () => val(props.homeIndicator) === false }),
    dot,
  ] }) as HTMLElement;
  const body = h("div", {
    class: () => cx("hm-device", `hm-device-${spec().kind ?? "phone"}`, `hm-device-cam-${val(props.camera) === false ? "none" : spec().camera ?? "none"}`, land() && "is-landscape", val(props.touch) !== false && "is-touch", val(props.class)),
    role: "group", "aria-label": label,
    style: () => {
      const s = spec(), w = land() ? s.height : s.width, hh = land() ? s.width : s.height;
      return { "--hm-dev-w": `${w}px`, "--hm-dev-h": `${hh}px`, "--hm-dev-r": `${s.radius ?? 24}px`, "--hm-dev-scale": String(scale()) };
    },
  }, h("div", { class: "hm-device-camera", "aria-hidden": "true" }), screen) as HTMLElement;
  const outer = h("div", { class: "hm-device-stage" }, body) as HTMLElement;

  // fit: scale the device down to the width (and a sensible height) of its place
  if (props.fit !== false && globalThis.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      const s = spec(), w = land() ? s.height : s.width, hh = land() ? s.width : s.height;
      const room = outer.clientWidth - 32, tall = Math.max(480, (globalThis.innerHeight ?? 900) - 160);
      scale.set(Math.min(1, room / (w + 28), tall / (hh + 28)));
    });
    ro.observe(outer);
    onCleanup(() => ro.disconnect());
  }

  // touch: the mouse acts like a finger — on the screen, or inside the iframe (same origin) on every page it loads
  const on = (): boolean => val(props.touch) !== false;
  const k = (): number => scale() || 1;
  const bind = (surface: Document | HTMLElement, root: () => HTMLElement, offset: () => { x: number; y: number }, zoomed: boolean): (() => void) => {
    let start: { x: number; y: number; target: Element | null; sx?: HTMLElement; sy?: HTMLElement; moved: boolean; id: number } | null = null;
    let last = { x: 0, y: 0, t: 0, vx: 0, vy: 0 };
    let fling: { cancel(): void } | null = null;
    let press: ReturnType<typeof setTimeout> | undefined;
    let dragged = false;
    const z = (): number => (zoomed ? k() : 1);
    const move = (e: PointerEvent): void => {
      if (!on()) return;
      const o = offset();
      // the `translate` property, not transform: the pressed `scale` then shrinks the dot in place instead of scaling its position
      dot.style.translate = `${o.x + e.clientX / z()}px ${o.y + e.clientY / z()}px`;
      if (!start || e.pointerId !== start.id) return;
      const dx = (e.clientX - last.x) / z(), dy = (e.clientY - last.y) / z(), dt = Math.max(1, e.timeStamp - last.t);
      if (!start.moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) { start.moved = true; clearTimeout(press); (start.target as HTMLElement | null)?.setPointerCapture?.(e.pointerId); }
      if (start.moved) {
        const r = root();
        start.sy ??= scrollerOf(start.target, r, "y");
        start.sx ??= scrollerOf(start.target, r, "x");
        start.sy.scrollTop -= dy;
        if (start.sx !== r || r.scrollWidth > r.clientWidth) start.sx.scrollLeft -= dx;
        last = { x: e.clientX, y: e.clientY, t: e.timeStamp, vx: dx / dt, vy: dy / dt };
      }
    };
    const down = (e: PointerEvent): void => {
      if (!on() || e.pointerType !== "mouse" || e.button !== 0) return;
      fling?.cancel();
      screen.classList.add("is-pressed");
      start = { x: e.clientX, y: e.clientY, target: e.target as Element, moved: false, id: e.pointerId };
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp, vx: 0, vy: 0 };
      // a long press opens the context menu, as on a phone
      press = setTimeout(() => { if (start && !start.moved) start.target?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY })); }, 550);
    };
    const end = (): void => {
      clearTimeout(press);
      screen.classList.remove("is-pressed");
      dragged = !!start?.moved;
      if (start?.moved && start.sy) {
        // the fling: the content keeps moving and slows down (motion engine: global speed and reduced motion apply)
        const sy = start.sy, v = last.vy * 16;
        if (Math.abs(v) > 0.5) { const from = sy.scrollTop; fling = animateValue(0, 1, { duration: 700, easing: "easeOutCubic", onUpdate: (p: number) => { sy.scrollTop = from - v * 22 * p; } }); }
      }
      start = null;
    };
    // a drag must not also click what it started on
    const click = (e: Event): void => { if (dragged) { dragged = false; e.preventDefault(); e.stopPropagation(); } };
    const noDrag = (e: Event): void => { if (on()) e.preventDefault(); };
    const enter = (): void => screen.classList.add("is-over"), leave = (): void => screen.classList.remove("is-over");
    const map: [string, EventListener, boolean?][] = [["pointermove", move as EventListener], ["pointerdown", down as EventListener], ["pointerup", end], ["pointercancel", end], ["click", click, true], ["dragstart", noDrag], ["pointerenter", enter], ["pointerleave", leave]];
    for (const [t, f, c] of map) surface.addEventListener(t, f, c);
    return () => { for (const [t, f, c] of map) surface.removeEventListener(t, f, c); fling?.cancel(); };
  };
  if (frame) {
    // each page the frame loads gets the finger (same origin only; a foreign page keeps the mouse)
    let unbind: (() => void) | undefined;
    const attach = (): void => {
      unbind?.();
      const doc = frame.contentDocument;
      if (!doc) return;
      const st = doc.createElement("style");
      st.textContent = "html.hm-touch-sim, html.hm-touch-sim * { cursor: none !important; } html.hm-touch-sim { -webkit-user-select: none; user-select: none; } html.hm-touch-sim :is(input, textarea, select, [contenteditable=true]) { user-select: text; } html.hm-touch-sim ::-webkit-scrollbar { display: none; } html.hm-touch-sim { scrollbar-width: none; }";
      doc.head?.appendChild(st);
      doc.documentElement.classList.toggle("hm-touch-sim", on());
      unbind = bind(doc, () => (doc.scrollingElement ?? doc.documentElement) as HTMLElement, () => ({ x: frame.offsetLeft, y: frame.offsetTop + viewport.offsetTop }), false);
    };
    frame.addEventListener("load", attach);
    onCleanup(() => unbind?.());
  } else {
    const off = bind(screen, () => viewport, () => { const r = screen.getBoundingClientRect(); return { x: -r.left / k(), y: -r.top / k() }; }, true);
    onCleanup(off);
  }

  return outer;
}
