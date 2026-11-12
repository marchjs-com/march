// Micro-interactions on the motion engine (`use:` actions and helpers; transform / opacity / clip-path only):
//   use:ripple                 ink ripple from the press point (keyboard: from the centre)
//   use:hoverParallax={{ depth: 12 }}   layers ([data-depth]) shift with the pointer, settle with a spring
//   stateMorph(button, "loading" | "success" | "error" | "idle", { confetti: true })   a button morphs through states
// (magnet, tilt and press live in gestures.ts; this file adds what they do not cover.)
import { animate, type Playback } from "./engine/playback.ts";
import { reducedNow } from "./engine/prefs.ts";
import { frame } from "./env.ts";
import { drawPath } from "./svg.ts";
import { listen, setStyle } from "../core/util.ts";
import { t } from "../core/i18n.ts";

const obj = <T extends object>(raw: unknown): Partial<T> => (raw && typeof raw === "object" ? (raw as Partial<T>) : {});
const NS = "http://www.w3.org/2000/svg";

export interface RippleOptions { duration: number; /** Ink opacity at the start. */ opacity: number; /** Always from the centre. */ center: boolean }

/** Action: an ink ripple from where the element was pressed (Enter / Space: from the centre). */
export function ripple(el: Element, raw?: unknown): () => void {
  const o = obj<RippleOptions>(raw);
  const h = el as HTMLElement;
  if (globalThis.getComputedStyle?.(h).position === "static") setStyle(h, { position: "relative" });
  setStyle(h, { overflow: "hidden", isolation: "isolate" });
  const spawn = (x: number, y: number): void => {
    if (reducedNow()) return;
    const r = h.getBoundingClientRect();
    const cx = o.center ? r.width / 2 : x - r.left, cy = o.center ? r.height / 2 : y - r.top;
    const size = Math.hypot(Math.max(cx, r.width - cx), Math.max(cy, r.height - cy)) * 2;
    const ink = globalThis.document.createElement("span");
    ink.setAttribute("aria-hidden", "true");
    setStyle(ink, { position: "absolute", left: `${cx - size / 2}px`, top: `${cy - size / 2}px`, width: `${size}px`, height: `${size}px`, "border-radius": "50%", background: "currentColor", "pointer-events": "none", "z-index": "-1", opacity: "0" });
    h.append(ink);
    const p = animate(ink, [{ transform: "scale(0)", opacity: o.opacity ?? 0.22 }, { offset: 0.6, opacity: (o.opacity ?? 0.22) * 0.8 }, { transform: "scale(1)", opacity: 0 }], { duration: o.duration ?? 650, easing: "out" });
    void p.finished.then(() => ink.remove(), () => ink.remove());
  };
  return listen(h, {
    pointerdown: (e: PointerEvent) => spawn(e.clientX, e.clientY),
    keydown: (e: KeyboardEvent) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { const r = h.getBoundingClientRect(); spawn(r.left + r.width / 2, r.top + r.height / 2); } },
  });
}

export interface HoverParallaxOptions { /** Largest shift in px (a layer moves depth × its data-depth). */ depth: number; /** Layer selector. */ selector: string; /** Also tilt the container (degrees). */ tilt: number }

/** Action: children marked `data-depth="0.2…1"` shift with the pointer (deeper ones more); the container may tilt. */
export function hoverParallax(el: Element, raw?: unknown): () => void {
  const o = obj<HoverParallaxOptions>(raw);
  const depth = o.depth ?? 14, tiltDeg = o.tilt ?? 0, sel = o.selector ?? "[data-depth]";
  const h = el as HTMLElement;
  let px = 0, py = 0, pending = false, inside = false;
  const settle: Playback[] = [];
  const layers = (): HTMLElement[] => Array.from(h.querySelectorAll<HTMLElement>(sel));
  const write = (): void => {
    pending = false;
    if (!inside) return;
    for (const l of layers()) { const d = Number(l.dataset.depth ?? 1) * depth; setStyle(l, { transform: `translate3d(${(px * d).toFixed(2)}px, ${(py * d).toFixed(2)}px, 0)` }); }
    if (tiltDeg) setStyle(h, { transform: `perspective(900px) rotateX(${(-py * tiltDeg).toFixed(2)}deg) rotateY(${(px * tiltDeg).toFixed(2)}deg)` });
  };
  const move = (e: PointerEvent): void => {
    if (reducedNow()) return;
    if (!inside) { inside = true; for (const s of settle.splice(0)) s.cancel(); }
    const r = h.getBoundingClientRect();
    px = (e.clientX - r.left) / (r.width || 1) - 0.5; py = (e.clientY - r.top) / (r.height || 1) - 0.5;
    if (!pending) { pending = true; frame(write); }
  };
  const leave = (): void => {
    if (!inside) return;
    inside = false;
    // spring back from where each layer is (unfilled: the inline transform is cleared first)
    const targets: HTMLElement[] = tiltDeg ? [...layers(), h] : layers();
    for (const l of targets) {
      const from = l.style.getPropertyValue("transform") || "none";
      setStyle(l, { transform: null });
      settle.push(animate(l, [{ transform: from }, { transform: "none" }], { duration: 700, easing: "spring-wobbly", fill: "none" }));
    }
  };
  const off = listen(h, { pointermove: move, pointerleave: leave });
  return () => { for (const s of settle.splice(0)) s.cancel(); off(); };
}

// ── state morph ──
export type ButtonState = "idle" | "loading" | "success" | "error";
export interface StateMorphOptions {
  /** Confetti from the button on success (hadi-march/fx, loaded on demand; never with reduced motion). */
  confetti?: boolean;
  duration?: number;
  /** Text announced to screen readers for each state (default: translated "Loading", "Done", "Failed"). */
  labels?: Partial<Record<ButtonState, string>>;
}

interface Saved { width: string; radius: string; live: HTMLElement; icon: SVGSVGElement; spin: Playback | null; state: ButtonState }
const saved = new WeakMap<HTMLElement, Saved>();
const css = (el: Element): Partial<CSSStyleDeclaration> => globalThis.getComputedStyle?.(el) ?? {};

function icon(kind: ButtonState): SVGElement {
  const el = globalThis.document.createElementNS(NS, kind === "loading" ? "circle" : "path");
  if (kind === "loading") for (const [k, v] of [["cx", "12"], ["cy", "12"], ["r", "8"], ["stroke-dasharray", "32 60"]]) el.setAttribute(k!, v!);
  else el.setAttribute("d", kind === "success" ? "M6 12.5l4 4 8-9" : "M7 7l10 10M17 7L7 17");
  return el;
}

/**
 * Morph a button between states: loading narrows it to a circle with a spinner, success and error draw a check or a
 * cross over the success / danger colour (error also shakes), idle restores it. The colours come from the theme tokens
 * through `data-hm-state` (motion.css). Returns the main Playback.
 */
export function stateMorph(el: Element, state: ButtonState, o: StateMorphOptions = {}): Playback {
  const h = el as HTMLElement;
  const dur = o.duration ?? 420;
  let s = saved.get(h);
  if (!s) {
    const cs = css(h);
    if (cs.position === "static") setStyle(h, { position: "relative" });
    const live = globalThis.document.createElement("span");
    live.setAttribute("aria-live", "polite");
    live.className = "hm-sr-only";
    const svg = globalThis.document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "hm-state-icon");
    h.append(live, svg);
    s = { width: h.style.getPropertyValue("width"), radius: h.style.getPropertyValue("border-radius"), live, icon: svg, spin: null, state: "idle" };
    saved.set(h, s);
  }
  const prev = s.state;
  s.state = state;
  const r = h.getBoundingClientRect();
  const look = (): Keyframe => { const c = css(h); return { borderRadius: c.borderRadius || "0px", ...(c.backgroundColor ? { backgroundColor: c.backgroundColor } : {}) }; };
  const from = { width: `${r.width}px`, ...look() };
  s.spin?.cancel(); s.spin = null;
  if (state === "idle") h.removeAttribute("data-hm-state"); else h.setAttribute("data-hm-state", state);
  h.toggleAttribute("aria-busy", state === "loading");
  if (state === "loading") h.setAttribute("aria-disabled", "true"); else h.removeAttribute("aria-disabled");
  const labels = { loading: t("Loading"), success: t("Done"), error: t("Failed"), idle: "", ...o.labels };
  s.live.textContent = labels[state] ?? "";

  // the end size: a circle while busy or done, the saved width when idle
  const round = state !== "idle";
  setStyle(h, { width: round ? `${r.height}px` : s.width || null, "border-radius": round ? "999px" : s.radius || null });
  // the idle width is the natural one: measure it without the inline width, then animate to that number
  const to = { width: `${round ? r.height : h.getBoundingClientRect().width}px`, ...look() };
  if (!round) setStyle(h, { width: s.width || null });
  const main = animate(h, [from, to], { duration: dur, easing: state === "idle" ? "spring-soft" : "expo" });

  // the icon: spinner / check / cross, drawn in
  s.icon.replaceChildren(...(state === "idle" ? [] : [icon(state)]));
  const shape = s.icon.firstElementChild;
  if (shape && state === "loading") s.spin = animate(s.icon, [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 800, iterations: Infinity, easing: "linear" });
  else if (shape) drawPath(shape, { duration: dur, delay: dur * 0.35, easing: "out" });
  if (state === "error") animate(h, [{ translate: "0" }, { translate: "-6px" }, { translate: "5px" }, { translate: "-3px" }, { translate: "2px" }, { translate: "0" }], { duration: 420, delay: dur * 0.5, easing: "out" });
  if (state === "success" && prev !== "success" && o.confetti && !reducedNow()) {
    const b = h.getBoundingClientRect(), root = css(globalThis.document.documentElement);
    const colors = ["--hm-brand-orange", "--hm-brand-blue", "--hm-brand-green", "--hm-brand-purple"].map((v) => root.getPropertyValue?.(v).trim() ?? "").filter(Boolean);
    void import("../fx/index.ts").then((fx) => fx.confetti({ x: b.left + b.width / 2, y: b.top + b.height / 2, count: 90, spread: 55, ...(colors.length ? { colors } : {}) }));
  }
  return main;
}
