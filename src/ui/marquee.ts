// OverflowText / Marquee (hadi-march/ui): text that scrolls only when it does not fit. Triggers: hover, focus, always,
// visible; modes: bounce, loop, once. Direction-aware (dir="auto", RTL scrolls the other way), fade mask at the
// logical edges, prefers-reduced-motion respected, screen readers read the text once (copies are aria-hidden).
// Motion is WAAPI on a transform only; no inline style attribute.
import "./marquee.css";
import { signal, computed, effect, getOwner, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { reducedMotion, frame } from "../motion/env.ts";
import { val, cx, on, type MaybeFn, type ClassProp } from "./util.ts";

export type MarqueeTrigger = "hover" | "focus" | "always" | "visible";
export type MarqueeMode = "bounce" | "loop" | "once";

export interface OverflowTextProps {
  /** The text (or pass children). */
  text?: MaybeFn<string | undefined>;
  children?: unknown;
  /** When to scroll (default hover + focus). "hover"/"focus" listen on the nearest link, button or list item. */
  trigger?: MarqueeTrigger | readonly MarqueeTrigger[];
  /** bounce: to the end and back (default) · loop: endless ticker with a separator · once: to the end and back, one time. */
  mode?: MarqueeMode;
  /** Pixels per second (default 40). */
  speed?: number;
  /** Hold at each end, ms (default 1000). */
  pause?: number;
  /** Wait before starting after the trigger, ms (default 250). */
  delay?: number;
  /** Loop separator (default "•"). */
  separator?: string;
  /** Fade the clipped edges (default true); false shows an ellipsis instead. */
  fade?: boolean;
  /** Extra condition that keeps it scrolling (e.g. the selected item of a menu): `play={() => isActive()}`. */
  play?: MaybeFn<boolean | undefined>;
  /** Element whose hover/focus starts it (default: closest a, button, li, label, [tabindex] — or itself). */
  host?: Element | (() => Element | null);
  class?: ClassProp;
  [attr: string]: unknown;
}

const HOST = "a, button, li, label, summary, [tabindex], [role=option], [role=menuitem], [role=tab]";
type Anim = { cancel(): void };

/**
 * `<OverflowText text="A very long title…" />` — scrolls on hover/focus only when clipped.
 * `<OverflowText trigger="visible" mode="loop" text={news} />`, `<OverflowText trigger="always" mode="bounce">…</OverflowText>`.
 */
export function OverflowText(props: OverflowTextProps): Element {
  const triggers = new Set<MarqueeTrigger>(props.trigger == null ? ["hover", "focus"] : typeof props.trigger === "string" ? [props.trigger] : props.trigger);
  const mode = props.mode ?? "bounce";
  const dist = signal(0); // how far the text overflows (px); 0 = fits
  const hovered = signal(false), focused = signal(false), visible = signal(!triggers.has("visible"));
  const running = signal(false);
  const label = signal("");

  const item = h("span", { class: "hm-marquee-item" }, props.text != null ? () => val(props.text) ?? "" : props.children) as HTMLElement;
  const track = h("span", { class: "hm-marquee-track" }, item) as HTMLElement;
  const { text: _t, children: _c, trigger: _tr, mode: _m, speed: _s, pause: _p, delay: _d, separator: _sep, fade: _f, host: _h, play: _pl, class: _cl, ...attrs } = props;
  const root = h("span", {
    dir: "auto", ...attrs,
    class: () => cx("hm-marquee", props.fade === false ? "hm-marquee-ellipsis" : "hm-marquee-fade", dist() > 0 && "is-overflow", running() && "is-running", val(props.class)),
    // the full text as a tooltip when it cannot scroll (reduced motion) and is clipped
    title: () => (dist() > 0 && reducedMotion() ? label() : null),
  }, track) as HTMLElement;

  const measure = (): void => {
    const d = Math.max(0, Math.ceil(item.scrollWidth - root.clientWidth));
    const next = d > 1 ? d : 0;
    if (Math.abs(next - dist.peek()) > 1 || (next === 0) !== (dist.peek() === 0)) dist.set(next);
    label.set(item.textContent ?? "");
  };

  const engaged = computed(() => (!!val(props.play) || triggers.has("always") || triggers.has("visible") || (triggers.has("hover") && hovered()) || (triggers.has("focus") && focused())) && visible());
  const wanted = computed(() => dist() > 0 && engaged() && !reducedMotion());

  let anim: Anim | null = null, timer: ReturnType<typeof setTimeout> | null = null, copies: Element[] = [];
  const stop = (): void => {
    if (timer) { clearTimeout(timer); timer = null; }
    anim?.cancel(); anim = null;
    for (const c of copies) c.remove();
    copies = [];
    running.set(false);
  };
  const start = (): void => {
    const el = track as HTMLElement & { animate?: (k: Keyframe[], o: KeyframeAnimationOptions) => Anim };
    if (typeof el.animate !== "function") return;
    const rtl = globalThis.getComputedStyle?.(root).direction === "rtl";
    const sign = rtl ? 1 : -1;
    const speed = Math.max(5, props.speed ?? 40), pause = Math.max(0, props.pause ?? 1000);
    running.set(true);
    if (mode === "loop") {
      const sep = h("span", { class: "hm-marquee-sep", "aria-hidden": "true" }, props.separator ?? "•");
      const copy = item.cloneNode(true) as HTMLElement;
      copy.setAttribute("aria-hidden", "true");
      copy.setAttribute("inert", "");
      track.append(sep, copy);
      copies = [sep, copy];
      const span = copy.getBoundingClientRect().left - item.getBoundingClientRect().left;
      const travel = (Math.abs(span) / speed) * 1000, total = travel + pause;
      anim = el.animate([
        { transform: "translateX(0)", offset: 0 },
        { transform: "translateX(0)", offset: pause / total },
        { transform: `translateX(${sign * Math.abs(span)}px)`, offset: 1 },
      ], { duration: total, iterations: Infinity, easing: "linear" });
      return;
    }
    const d = dist.peek(), travel = (d / speed) * 1000, total = 2 * travel + 2 * pause;
    const end = `translateX(${sign * d}px)`;
    anim = el.animate([
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(0)", offset: pause / total, easing: "ease-in-out" },
      { transform: end, offset: (pause + travel) / total },
      { transform: end, offset: (2 * pause + travel) / total, easing: "ease-in-out" },
      { transform: "translateX(0)", offset: 1 },
    ], { duration: total, iterations: mode === "once" ? 1 : Infinity, fill: "none" });
    if (mode === "once") (anim as Anim & { onfinish?: () => void }).onfinish = () => { anim = null; running.set(false); };
  };

  effect(() => {
    const go = wanted();
    dist(); // restart when the size changes
    stop();
    if (go) timer = setTimeout(() => { timer = null; start(); }, Math.max(0, props.delay ?? 250));
  });

  // wire up once the element is in the document
  const offs: Array<() => void> = [];
  let tries = 0;
  const connect = (): void => {
    if (!root.isConnected) { if (++tries < 120) offs.push(frame(connect)); return; }
    const host = (typeof props.host === "function" ? props.host() : props.host) ?? root.parentElement?.closest(HOST) ?? root;
    if (triggers.has("hover")) offs.push(on(host, "pointerenter", () => hovered.set(true)), on(host, "pointerleave", () => hovered.set(false)));
    if (triggers.has("focus")) offs.push(on(host, "focusin", () => focused.set(true)), on(host, "focusout", () => focused.set(false)));
    const RO = globalThis.ResizeObserver;
    if (RO) { const ro = new RO(measure); ro.observe(root); ro.observe(item); offs.push(() => ro.disconnect()); }
    if (globalThis.MutationObserver) { const mo = new MutationObserver(measure); mo.observe(item, { childList: true, characterData: true, subtree: true }); offs.push(() => mo.disconnect()); }
    const IO = globalThis.IntersectionObserver;
    if (triggers.has("visible") && IO) { const io = new IO((es) => visible.set(es.some((e) => e.isIntersecting))); io.observe(root); offs.push(() => io.disconnect()); }
    else if (triggers.has("visible")) visible.set(true);
    measure();
  };
  offs.push(frame(connect));
  if (getOwner()) onCleanup(() => { stop(); for (const f of offs) f(); });
  return root;
}

/** A ticker: `<Marquee text="…" />` = OverflowText that loops whenever it is on screen. */
export function Marquee(props: OverflowTextProps): Element {
  return OverflowText({ trigger: "visible", mode: "loop", ...props });
}
