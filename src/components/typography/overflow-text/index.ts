// OverflowText / Marquee (march/ui): text that scrolls only when it does not fit. Triggers: hover, focus, always,
// visible; modes: bounce, loop, once. Direction-aware (dir="auto", RTL scrolls the other way), fade mask at the
// logical edges, prefers-reduced-motion respected, screen readers read the text once (copies are aria-hidden).
// Motion is WAAPI on a transform only; no inline style attribute.
import "./overflow-text.css";
import { signal, computed, effect, getOwner, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { reducedMotion, frame, animateEl } from "../../../motion/env.ts";
import { val, cx, on, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { isRtl } from "../../../core/util.ts";

export type MarqueeTrigger = "hover" | "focus" | "always" | "visible";
export type MarqueeMode = "bounce" | "loop" | "once";

export interface OverflowTextProps {
  /** The text (or pass children). @tr Metin (ya da children ver). */
  text?: MaybeFn<string | undefined>;
  /** The content, when `text` is not given. @tr `text` verilmediğinde içerik. */
  children?: unknown;
  /** When to scroll (default hover + focus). "hover"/"focus" listen on the nearest link, button or list item. @tr Ne zaman kayar (varsayılan hover + focus). "hover"/"focus" en yakın bağlantıyı, düğmeyi ya da liste öğesini dinler. */
  trigger?: MarqueeTrigger | readonly MarqueeTrigger[];
  /** bounce: to the end and back (default) · loop: endless ticker with a separator · once: to the end and back, one time. @tr bounce: sona gidip döner (varsayılan) · loop: ayraçlı sonsuz kayan yazı · once: sona gidip döner, bir kez. */
  mode?: MarqueeMode;
  /** Pixels per second (default 40). @tr Saniyede piksel (varsayılan 40). */
  speed?: number;
  /** Hold at each end, ms (default 1000). @tr Her uçta bekleme, ms (varsayılan 1000). */
  pause?: number;
  /** Wait before starting after the trigger, ms (default 250). @tr Tetiklendikten sonra başlamadan önce bekleme, ms (varsayılan 250). */
  delay?: number;
  /** Loop separator: text or a node (default "•"); false puts nothing between the copies. @tr Döngü ayracı: metin ya da düğüm (varsayılan "•"); false kopyalar arasına bir şey koymaz. */
  separator?: unknown;
  /** Easing of each travel in bounce / once (default "ease-in-out"); the loop is always linear. @tr bounce / once içinde her gidişin eğrisi (varsayılan "ease-in-out"); döngü hep doğrusaldır. */
  easing?: string;
  /**
   * An endless strip (logos, quotes): the content is repeated so the strip is wider than its box and always loops.
   * `true`: as many copies as fill the width (at least one); a number: that many copies. Copies are hidden from
   * assistive technology and inert; each unit is a `.m-marquee-unit`.
   * @tr Sonsuz şerit (logolar, alıntılar): içerik, şerit kutusundan geniş olacak ve hep dönecek kadar tekrarlanır. `true`: genişliği dolduracak kadar kopya (en az bir); sayı: o kadar kopya. Kopyalar yardımcı teknolojiden gizli ve etkisizdir; her birim bir `.m-marquee-unit`.
   */
  duplicate?: boolean | number;
  /** Never scroll (the text stays clipped with its fade or ellipsis): `disabled={() => !settings.motion}`. @tr Hiç kaymaz (metin solma ya da üç noktayla kırpık kalır): `disabled={() => !settings.motion}`. */
  disabled?: MaybeFn<boolean | undefined>;
  /** Fade the clipped edges (default true); false shows an ellipsis instead. @tr Kırpılan kenarları soldurur (varsayılan true); false yerine üç nokta gösterir. */
  fade?: boolean;
  /** Extra condition that keeps it scrolling (e.g. the selected item of a menu): `play={() => isActive()}`. @tr Kaymayı sürdüren ek koşul (ör. menünün seçili öğesi): `play={() => isActive()}`. */
  play?: MaybeFn<boolean | undefined>;
  /** Element whose hover/focus starts it (default: closest a, button, li, label, [tabindex] — or itself). @tr Üzerine gelme / odağı kaymayı başlatan öğe (varsayılan: en yakın a, button, li, label, [tabindex] — ya da kendisi). */
  host?: Element | (() => Element | null);
  /** Extra classes on the text box. @tr Metin kutusuna eklenen sınıflar. */
  class?: ClassProp;
  [attr: string]: unknown;
}

// the measures asked for in one turn: all read, then all written
const reads = new Set<() => () => void>();
let queued = false;
const later = (r: () => () => void): void => {
  reads.add(r);
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; const list = [...reads]; reads.clear(); for (const w of list.map((f) => f())) w(); });
};
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

  const content = props.text != null ? () => val(props.text) ?? "" : props.children;
  // duplicate: the content sits in a unit and its copies follow it inside the item (a fixed count, or enough to fill the width)
  const fill = props.duplicate === true, fixed = fill ? 0 : Math.max(0, Math.floor(Number(props.duplicate) || 0));
  const unit = fill || fixed ? h("span", { class: "m-marquee-unit" }, content) as HTMLElement : null;
  const item = h("span", { class: "m-marquee-item" }, unit ?? content) as HTMLElement;
  const twins: HTMLElement[] = [];
  const rev = signal(0); // bumped when the copies are rebuilt: a running loop starts over with the new content
  const twin = (n: number): void => {
    if (!unit) return;
    while (twins.length > n) twins.pop()?.remove();
    while (twins.length < n) { const c = unit.cloneNode(true) as HTMLElement; c.setAttribute("aria-hidden", "true"); c.setAttribute("inert", ""); item.append(c); twins.push(c); }
  };
  twin(fill ? 1 : fixed);
  const track = h("span", { class: "m-marquee-track" }, item) as HTMLElement;
  const { text: _t, children: _c, trigger: _tr, mode: _m, speed: _s, pause: _p, delay: _d, separator: _sep, fade: _f, host: _h, play: _pl, class: _cl, easing: _e, disabled: _dis, duplicate: _dup, ...attrs } = props;
  const root = h("span", {
    dir: "auto", ...attrs,
    class: () => cx("m-marquee", props.fade === false ? "m-marquee-ellipsis" : "m-marquee-fade", dist() > 0 && "is-overflow", running() && "is-running", val(props.class)),
    // the full text as a tooltip when it cannot scroll (reduced motion) and is clipped
    title: () => (dist() > 0 && reducedMotion() ? label() : null),
  }, track) as HTMLElement;

  // measuring reads the layout and then writes (the overflow class): every instance's read comes first, then the
  // writes (one batch, see later()), so many titles shown at once (a dock's tabs) lay the page out once, not once each
  const read = (): (() => void) => {
    // fill: how many copies the width needs is read here; they are added in the write, and a new measure follows
    let copies = twins.length;
    if (fill && unit) { const w = unit.getBoundingClientRect().width; if (w > 0) copies = Math.min(24, Math.max(1, Math.ceil(root.clientWidth / w))); }
    const d = Math.max(0, Math.ceil(item.scrollWidth - root.clientWidth));
    const next = d > 1 ? d : 0, text = (unit ?? item).textContent ?? "";
    return () => {
      if (copies !== twins.length) { twin(copies); measure(); return; }
      if (Math.abs(next - dist.peek()) > 1 || (next === 0) !== (dist.peek() === 0)) dist.set(next);
      label.set(text);
    };
  };
  const measure = (): void => later(read);

  const engaged = computed(() => (!!val(props.play) || triggers.has("always") || triggers.has("visible") || (triggers.has("hover") && hovered()) || (triggers.has("focus") && focused())) && visible());
  const wanted = computed(() => dist() > 0 && engaged() && !val(props.disabled) && !reducedMotion());

  let anim: Anim | null = null, fadeAnim: Anim | null = null, timer: ReturnType<typeof setTimeout> | null = null, copies: Element[] = [];
  const stop = (): void => {
    if (timer) { clearTimeout(timer); timer = null; }
    anim?.cancel(); anim = null;
    fadeAnim?.cancel(); fadeAnim = null;
    for (const c of copies) c.remove();
    copies = [];
    running.set(false);
  };
  const start = (): void => {
    const el = track as HTMLElement & { animate?: (k: Keyframe[], o: KeyframeAnimationOptions) => Anim };
    if (typeof el.animate !== "function") return;
    const rtl = isRtl(root);
    const sign = rtl ? 1 : -1;
    const speed = Math.max(5, props.speed ?? 40), pause = Math.max(0, props.pause ?? 1000);
    running.set(true);
    // The fade follows the text: only the side that hides text fades. Before moving only the end fades (the first letter is
    // whole), while moving both, at the end of a bounce only the start (the last letter is whole). Two registered custom
    // properties (marquee.css @property) carry the widths; this animation runs on the root with the same timing.
    const F = "var(--m-marquee-fade, 14px)";
    const fadeFrames = (stops: Array<[number, boolean, boolean]>): Keyframe[] => stops.map(([offset, s, e]) => ({ offset, "--m-mq-fs": s ? F : "0px", "--m-mq-fe": e ? F : "0px" } as Keyframe));
    const fade = (frames: Keyframe[], o: KeyframeAnimationOptions): void => {
      const r = root as HTMLElement & { animate?: (k: Keyframe[], o: KeyframeAnimationOptions) => Anim };
      if (props.fade !== false && typeof r.animate === "function") { try { fadeAnim = animateEl(r, frames, o); } catch { fadeAnim = null; } }
    };
    if (mode === "loop") {
      const sep = props.separator === false ? null : h("span", { class: "m-marquee-sep", "aria-hidden": "true" }, props.separator ?? "•");
      const copy = item.cloneNode(true) as HTMLElement;
      copy.setAttribute("aria-hidden", "true");
      copy.setAttribute("inert", "");
      copies = sep ? [sep, copy] : [copy];
      track.append(...copies);
      const span = copy.getBoundingClientRect().left - item.getBoundingClientRect().left;
      const travel = (Math.abs(span) / speed) * 1000, total = travel + pause;
      anim = animateEl(el, [
        { transform: "translateX(0)", offset: 0 },
        { transform: "translateX(0)", offset: pause / total },
        { transform: `translateX(${sign * Math.abs(span)}px)`, offset: 1 },
      ], { duration: total, iterations: Infinity, easing: "linear" });
      const p = pause / total, e = Math.min(0.03, (1 - p) / 4);
      fade(fadeFrames([[0, false, true], [p, false, true], [Math.min(1, p + e), true, true], [1, true, true]]), { duration: total, iterations: Infinity });
      return;
    }
    const d = dist.peek(), travel = (d / speed) * 1000, total = 2 * travel + 2 * pause;
    const end = `translateX(${sign * d}px)`, ease = props.easing ?? "ease-in-out";
    anim = animateEl(el, [
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(0)", offset: pause / total, easing: ease },
      { transform: end, offset: (pause + travel) / total },
      { transform: end, offset: (2 * pause + travel) / total, easing: ease },
      { transform: "translateX(0)", offset: 1 },
    ], { duration: total, iterations: mode === "once" ? 1 : Infinity, fill: "none" });
    const a = pause / total, b = (pause + travel) / total, c = (2 * pause + travel) / total, e = Math.min(0.03, travel / total / 4);
    fade(fadeFrames([[0, false, true], [a, false, true], [a + e, true, true], [b - e, true, true], [b, true, false], [c, true, false], [c + e, true, true], [1 - e, true, true], [1, false, true]]),
      { duration: total, iterations: mode === "once" ? 1 : Infinity, fill: "none" });
    if (mode === "once" && anim) (anim as Anim & { onfinish?: () => void }).onfinish = () => { anim = null; running.set(false); };
  };

  effect(() => {
    const go = wanted();
    dist(); rev(); // restart when the size or the copied content changes
    stop();
    if (go) timer = setTimeout(() => { timer = null; start(); }, Math.max(0, props.delay ?? 250));
  });

  // wire up once the element is in the document
  const offs: Array<() => void> = [];
  let tries = 0;
  let wired = false;
  const connect = (): void => {
    if (wired) return;
    if (!root.isConnected) {
      if (++tries < 120) { offs.push(frame(connect)); return; }
      // built long before it is shown (a menu's content made ahead): wire up when it is first laid out
      const RO0 = globalThis.ResizeObserver;
      if (RO0) { const ro0 = new RO0(() => { if (root.isConnected) { ro0.disconnect(); connect(); } }); ro0.observe(root); offs.push(() => ro0.disconnect()); }
      return;
    }
    wired = true;
    const host = (typeof props.host === "function" ? props.host() : props.host) ?? root.parentElement?.closest(HOST) ?? root;
    if (triggers.has("hover")) offs.push(on(host, "pointerenter", () => hovered.set(true)), on(host, "pointerleave", () => hovered.set(false)));
    if (triggers.has("focus")) offs.push(on(host, "focusin", () => focused.set(true)), on(host, "focusout", () => focused.set(false)));
    const RO = globalThis.ResizeObserver;
    if (RO) { const ro = new RO(measure); ro.observe(root); ro.observe(item); offs.push(() => ro.disconnect()); }
    if (globalThis.MutationObserver) {
      // content that changes inside the unit: its copies are made again
      const mo = new MutationObserver((recs) => { if (unit && recs.some((r) => unit.contains(r.target))) { const n = twins.length; twin(0); twin(n); rev.set(rev.peek() + 1); } measure(); });
      mo.observe(item, { childList: true, characterData: true, subtree: true }); offs.push(() => mo.disconnect());
    }
    const IO = globalThis.IntersectionObserver;
    if (triggers.has("visible") && IO) { const io = new IO((es) => visible.set(es.some((e) => e.isIntersecting))); io.observe(root); offs.push(() => io.disconnect()); }
    else if (triggers.has("visible")) visible.set(true);
    // a ResizeObserver reports the first size by itself (after layout): measured then, not here
    if (!RO) measure();
  };
  offs.push(frame(connect));
  if (getOwner()) onCleanup(() => { stop(); for (const f of offs) f(); });
  return root;
}

/** A ticker: `<Marquee text="…" />` = OverflowText that loops whenever it is on screen; `<Marquee duplicate separator={false}>{logos}</Marquee>` is an endless strip. */
export function Marquee(props: OverflowTextProps): Element {
  return OverflowText({ trigger: "visible", mode: "loop", ...props });
}
