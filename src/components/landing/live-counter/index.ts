// LiveCounter (march/landing): a number that grows while you watch ("people on HADİ right now"). Give it a value
// (a signal fed by your server) or a start and a `rate` per minute: it then adds small random steps on the motion
// clock, only while it is on screen. Every part is yours to choose: how the digits change (`effect`: the odometer roll,
// none, or any text animation of march/motion/text: scramble, splitFlap, odometer, glitch…), the live dot (off,
// a colour, or your own node), the "+N" bubble that rises on every increase (off, a colour, or your own content) and
// the small beat of the number. Screen readers read the label and the value; moving digits and bubbles are hidden.
import "./live-counter.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack, createRoot, getOwner } from "../../../core/reactive.ts";
import { locale } from "../../../core/i18n.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { owned, whenVisible } from "../../../ui/observe.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { Badge } from "../../data/badge/index.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { Counter, formatCount } from "../counter/index.ts";
import { withColor } from "../../../theme/colors.ts";

/** A text animation of march/motion/text (`scramble`, `splitFlap`, `odometer`, `pop`…): `(el, options) => { stop }`. */
export type LiveCounterEffect = (el: HTMLElement, options?: never) => { stop(): void };

export interface LiveCounterProps {
  /** The live value (a signal or accessor fed by your data). @tr Canlı değer (verinizle beslenen bir sinyal ya da erişimci). */
  value?: MaybeFn<number> | undefined;
  /** First value when the counter simulates growth with `rate`. @tr Sayaç `rate` ile büyüme taklit ederken ilk değer. */
  from?: number | undefined;
  /** Average increase per minute (simulated growth when no `value` is given). @tr Dakika başına ortalama artış (`value` verilmediğinde taklit edilen büyüme). */
  rate?: number | undefined;
  /** Shortest and longest pause between simulated steps, ms (default [1500, 4500]). @tr Taklit edilen adımlar arasındaki en kısa ve en uzun bekleme, ms (varsayılan [1500, 4500]). */
  pause?: [number, number] | undefined;
  /** What is counted: "people online". @tr Sayılan şey: "çevrimiçi kişi". */
  label?: unknown | undefined;
  /** Node before the number. @tr Sayının önündeki düğüm. */
  prefix?: unknown | undefined;
  /** Node after the number. @tr Sayının arkasındaki düğüm. */
  suffix?: unknown | undefined;
  /** Intl.NumberFormat options. @tr Intl.NumberFormat seçenekleri. */
  format?: Intl.NumberFormatOptions | undefined;
  /** How the digits change: "roll" (odometer, default), "none", or a text animation (`effect={scramble}`). @tr Basamakların nasıl değiştiği: "roll" (kilometre sayacı, varsayılan), "none" ya da bir metin animasyonu (`effect={scramble}`). */
  effect?: "roll" | "none" | LiveCounterEffect | undefined;
  /** Options for the text animation (`{ duration: 800 }`); a counting one also gets `start`: the previous value. @tr Metin animasyonunun seçenekleri (`{ duration: 800 }`); sayan bir animasyon ayrıca `start` olarak önceki değeri alır. */
  effectOptions?: Record<string, unknown> | undefined;
  /** The live dot: true (default), false, or your own node. @tr Canlı nokta: true (varsayılan), false ya da kendi düğümünüz. */
  dot?: boolean | Node | undefined;
  /** Colour of the dot and its pulse (default: success). @tr Noktanın ve nabzının rengi (varsayılan: success). */
  dotColor?: ColorToken | undefined;
  /** The "+N" bubble on every increase: true (default), false, or `(diff, text) => content`. @tr Her artışta "+N" baloncuğu: true (varsayılan), false ya da `(diff, text) => content`. */
  bubble?: boolean | ((diff: number, text: string) => unknown) | undefined;
  /** Colour of the bubble (default: success). @tr Baloncuğun rengi (varsayılan: success). */
  bubbleColor?: ColorToken | undefined;
  /** The number beats once on every increase (default true). @tr Sayı her artışta bir kez atar (varsayılan true). */
  beat?: boolean | undefined;
  /** Random source for the simulated steps (tests). @tr Taklit edilen adımlar için rastgele sayı kaynağı (testler). */
  random?: (() => number) | undefined;
  /** Extra CSS class on the root. @tr Köke eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
}

/** `<LiveCounter value={$online} label="people online" />`, `<LiveCounter from={12840} rate={30} effect={splitFlap} dotColor="brand-orange" />` */
export function LiveCounter(props: LiveCounterProps): Element {
  const n = signal(untrack(() => val(props.value)) ?? props.from ?? 0);
  if (props.value !== undefined) effect(() => { const v = val(props.value); if (v != null) n.set(v); });
  const fx = props.effect ?? "roll";
  const fmt = (v: number): string => formatCount(v, { format: props.format }, locale());

  // the number: the odometer Counter, or plain text that a text animation redraws on every change
  let text: HTMLElement | null = null;
  const number = typeof fx === "function" || fx === "none"
    ? h("span", { class: "m-lc-plain" }, props.prefix ?? null, text = h("span", { class: "m-lc-text" }, fmt(untrack(n))) as HTMLElement, props.suffix ?? null)
    : h(Counter, { value: n, mode: "roll", start: "now", format: props.format, prefix: props.prefix, suffix: props.suffix });
  const dot = props.dot === false ? null
    : props.dot && props.dot !== true ? h("span", { class: "m-lc-dot-own", "aria-hidden": "true" }, props.dot)
    : withColor(h(StatusDot, { class: "m-lc-dot", size: "lg", pulse: true }), props.dotColor);

  const root = h("div", { class: () => cx("m-lc", val(props.class)) },
    dot,
    h("span", { class: "m-lc-num" }, number, h("span", { class: "m-lc-bubbles", "aria-hidden": "true" })),
    props.label != null ? h("span", { class: "m-lc-label" }, props.label) : null) as HTMLElement;

  // simulated growth: a step every pause[0]–pause[1] ms of clock time, sized so the average matches `rate` per minute
  if (props.value === undefined && props.rate) {
    const rnd = props.random ?? Math.random;
    const [lo, hi] = props.pause ?? [1500, 4500];
    let acc = 0, wait = lo + rnd() * (hi - lo), stop: (() => void) | null = null;
    const run = (on: boolean): void => {
      if (on && !stop) stop = onFrame((_t, dt) => {
        acc += dt;
        if (acc < wait) return;
        const step = Math.max(1, Math.round((props.rate! * acc) / 60000 * (0.5 + rnd())));
        acc = 0; wait = lo + rnd() * (hi - lo);
        n.set(n.peek() + step);
      });
      else if (!on && stop) { stop(); stop = null; }
    };
    whenVisible(root, run); // only while on screen (stops with the owner)
  }

  // every change: the text animation (if any) redraws the digits; on an increase the bubble rises and the number beats
  let last = n.peek(), anim: { stop(): void } | null = null;
  const owner = getOwner();
  effect(() => {
    const v = n();
    untrack(() => {
      const d = v - last, prev = last; last = v;
      if (text) {
        anim?.stop(); anim = null;
        text.textContent = fmt(v);
        if (typeof fx === "function" && d && !reducedMotion()) anim = fx(text, { start: prev, ...props.effectOptions } as never);
      }
      if (d <= 0 || reducedMotion()) return;
      const num = root.querySelector<HTMLElement>(".m-lc-num"), box = root.querySelector(".m-lc-bubbles");
      if (num && box && props.bubble !== false) {
        const label = `+${fmt(d)}`;
        // the default bubble is a Badge; your own content gets a bare box. Each bubble has its own scope (not the
        // effect's: the next change must not dispose a bubble that is still rising)
        createRoot((dispose) => {
          const b = (typeof props.bubble === "function" ? h("span", { class: "m-lc-bubble is-own" }, props.bubble(d, label))
            : withColor(h(Badge, { class: "m-lc-bubble", tone: props.bubbleColor ? "primary" : "success" }, label), props.bubbleColor)) as HTMLElement;
          box.append(b);
          void animate(b, { opacity: [0, 1, 1, 0], transform: ["translateY(10px) scale(.6)", "translateY(-6px) scale(1.1)", "translateY(-22px) scale(1)", "translateY(-40px) scale(.9)"] }, { duration: 1500, easing: "out" })
            .finished.then(() => { b.remove(); dispose(); });
        }, owner);
      }
      if (num && props.beat !== false) animate(num, { transform: ["scale(1)", "scale(1.06)", "scale(1)"] }, { duration: 520, easing: "out" });
    });
  });
  owned(() => anim?.stop());
  return root;
}
