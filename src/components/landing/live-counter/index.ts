// LiveCounter (hadi-march/landing): a number that grows while you watch ("people on HADİ right now"). Give it a value
// (a signal fed by your server) or a start and a `rate` per minute: it then adds small random steps on the motion
// clock, only while it is on screen. The digits roll like an odometer (Counter, roll mode); a pulsing dot marks it as
// live. Every increase sends a "+N" bubble up beside the number and gives the number a small beat.
// Screen readers read the label and the value once; the moving digits and the bubbles are hidden from them.
import "./live-counter.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack, onCleanup, getOwner } from "../../../core/reactive.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { formatCount } from "../counter/index.ts";
import { Counter } from "../counter/index.ts";

export interface LiveCounterProps {
  /** The live value (a signal or accessor fed by your data). */
  value?: MaybeFn<number> | undefined;
  /** First value when the counter simulates growth with `rate`. */
  from?: number | undefined;
  /** Average increase per minute (simulated growth when no `value` is given). */
  rate?: number | undefined;
  /** What is counted: "people online". */
  label?: unknown | undefined;
  prefix?: unknown | undefined;
  suffix?: unknown | undefined;
  /** Intl.NumberFormat options. */
  format?: Intl.NumberFormatOptions | undefined;
  /** Show the pulsing live dot (default true). */
  dot?: boolean | undefined;
  /** Random source for the simulated steps (tests). */
  random?: (() => number) | undefined;
  class?: ClassProp | undefined;
}

/** `<LiveCounter value={$online} label="people online" />`, `<LiveCounter from={12840} rate={30} label="events this week" />` */
export function LiveCounter(props: LiveCounterProps): Element {
  const n = signal(untrack(() => val(props.value)) ?? props.from ?? 0);
  if (props.value !== undefined) effect(() => { const v = val(props.value); if (v != null) n.set(v); });

  const root = h("div", { class: () => cx("hm-lc", val(props.class)) },
    props.dot === false ? null : h("span", { class: "hm-lc-dot", "aria-hidden": "true" }),
    h("span", { class: "hm-lc-num" }, h(Counter, { value: n, mode: "roll", start: "now", format: props.format, prefix: props.prefix, suffix: props.suffix }),
      h("span", { class: "hm-lc-bubbles", "aria-hidden": "true" })),
    props.label != null ? h("span", { class: "hm-lc-label" }, props.label) : null) as HTMLElement;

  // simulated growth: a step every 1.5–4.5 s of clock time, sized so the average matches `rate` per minute
  if (props.value === undefined && props.rate) {
    const rnd = props.random ?? Math.random;
    let acc = 0, wait = 1500 + rnd() * 3000, stop: (() => void) | null = null;
    const run = (on: boolean): void => {
      if (on && !stop) stop = onFrame((_t, dt) => {
        acc += dt;
        if (acc < wait) return;
        const step = Math.max(1, Math.round((props.rate! * acc) / 60000 * (0.5 + rnd())));
        acc = 0; wait = 1500 + rnd() * 3000;
        n.set(n.peek() + step);
      });
      else if (!on && stop) { stop(); stop = null; }
    };
    const IO = globalThis.IntersectionObserver;
    if (IO) {
      const io = new IO((es) => run(es.some((e) => e.isIntersecting)));
      io.observe(root);
      if (getOwner()) onCleanup(() => io.disconnect());
    } else run(true);
    if (getOwner()) onCleanup(() => run(false));
  }
  // every increase: a "+N" bubble rises and fades, the number beats once
  let last = n.peek();
  effect(() => {
    const v = n();
    untrack(() => {
      const d = v - last; last = v;
      if (d <= 0 || reducedMotion()) return;
      const num = root.querySelector<HTMLElement>(".hm-lc-num"), box = root.querySelector(".hm-lc-bubbles");
      if (!num || !box) return;
      const b = h("span", { class: "hm-lc-bubble" }, `+${formatCount(d, { format: props.format })}`) as HTMLElement;
      box.append(b);
      void animate(b, { opacity: [0, 1, 1, 0], transform: ["translateY(10px) scale(.6)", "translateY(-6px) scale(1.1)", "translateY(-22px) scale(1)", "translateY(-40px) scale(.9)"] }, { duration: 1500, easing: "out" })
        .finished.then(() => b.remove());
      animate(num, { transform: ["scale(1)", "scale(1.06)", "scale(1)"] }, { duration: 520, easing: "out" });
    });
  });
  return root;
}
