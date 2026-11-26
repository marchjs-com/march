// The time of the clock components (AnalogClock, FlipClock): a date's hours, minutes and seconds in a time zone, and
// the beat that redraws them once a second while the clock is on screen. One form for every clock.
//   clockParts(new Date(), { timeZone: "Europe/Istanbul", hour12: false })
//   const tick = secondBeat(); … tick.watch(root, () => props.onTick?.(date()))   // read tick.beat() to redraw each second
import { signal, effect, untrack, onCleanup, type Accessor } from "../core/reactive.ts";
import { later } from "../core/util.ts";
import { whenVisible } from "./observe.ts";

export interface ClockParts { hours: number; minutes: number; seconds: number; ms: number; period: string }
export interface ClockPartsOptions { timeZone?: string | undefined; hour12?: boolean | undefined; lang?: string | undefined }

const formats = new Map<string, Intl.DateTimeFormat>();
/** A date's parts on a 24-hour clock (or a 12-hour one with its day period text), in a time zone or the device's. */
export function clockParts(d: Date, o: ClockPartsOptions = {}): ClockParts {
  if (!o.timeZone && !o.hour12) return { hours: d.getHours(), minutes: d.getMinutes(), seconds: d.getSeconds(), ms: d.getMilliseconds(), period: "" };
  const key = `${o.lang ?? ""}|${o.timeZone ?? ""}|${o.hour12 ? 12 : 24}`;
  let f = formats.get(key);
  if (!f) formats.set(key, (f = new Intl.DateTimeFormat(o.lang || "en", { hour: "numeric", minute: "numeric", second: "numeric", hourCycle: o.hour12 ? "h12" : "h23", ...(o.timeZone ? { timeZone: o.timeZone } : {}) })));
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) if (x.type !== "literal") p[x.type] = x.value;
  return { hours: Number(p.hour ?? 0) % (o.hour12 ? 13 : 24), minutes: Number(p.minute ?? 0), seconds: Number(p.second ?? 0), ms: d.getMilliseconds(), period: o.hour12 ? (p.dayPeriod ?? "") : "" };
}

/**
 * The clock's heartbeat: `beat()` is bumped on each whole second once `watch(el, onSecond)` runs, while `el` is on
 * screen (time stays true while motion is paused); `bump()` adds a beat (a smooth hand bumps it every frame). The chain
 * of timers runs outside the owner, so one cleanup clears whichever is pending.
 *   const tick = secondBeat(); const date = computed(() => { tick.beat(); return new Date() }); … tick.watch(root)
 */
export function secondBeat(): { beat: Accessor<number>; visible: Accessor<boolean>; bump: () => void; watch: (el: Element, onSecond?: () => void) => void } {
  const beat = signal(0), visible = signal(false);
  const bump = (): void => { beat.set(beat.peek() + 1); };
  const watch = (el: Element, onSecond?: () => void): void => {
    whenVisible(el, (v) => visible.set(v));
    effect(() => {
      if (!visible()) return;
      const wait = (): number => 1000 - (Date.now() % 1000) + 2;
      let id: ReturnType<typeof setTimeout>;
      const second = (): void => { bump(); untrack(() => onSecond?.()); id = later(second, wait()); };
      id = later(second, wait());
      onCleanup(() => clearTimeout(id));
    });
  };
  return { beat, visible, bump, watch };
}
