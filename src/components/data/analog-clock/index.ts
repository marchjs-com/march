// AnalogClock (march/ui): a 12-hour dial with hour, minute and second hands, as on a wall clock or a fine watch. It is
// a Gauge (a 360° scale from 12 o'clock that wraps, three needles): the clock only turns the time into hand values,
// keeps them continuous (a hand takes the short way round at 12 and when the time is set back) and ticks the time.
// The second hand ticks once a second on a spring (a quartz tick) or sweeps smoothly; the time is the system clock, a
// time zone's, or your own source (a Date, a timestamp or a live accessor).
//   <AnalogClock />   <AnalogClock timeZone="Asia/Tokyo" caption="Tokyo" seconds="smooth" />   <AnalogClock time={$t} />
import "./analog-clock.css";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { clockParts, secondBeat } from "../../../ui/clock.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { still } from "../../../motion/engine/parts.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Gauge, unwrap, type GaugeNeedle } from "../gauge/index.ts";

/** A hand's look: everything of a Gauge needle but its value. @tr Bir akrebin / yelkovanın görünümü: değeri dışında bir Gauge ibresinin her şeyi. */
export type ClockHand = Omit<GaugeNeedle, "value">;
/** The parts of the dial on or off. @tr Kadranın parçaları açık ya da kapalı. */
export interface ClockParts { face?: boolean; ticks?: boolean; numbers?: boolean; hub?: boolean; glass?: boolean; caption?: boolean }

export interface AnalogClockProps {
  /** Your own time source: a Date, a timestamp (ms) or a live accessor of one. Default: the system clock. @tr Kendi zaman kaynağınız: bir Date, bir zaman damgası (ms) ya da bunun canlı erişimcisi. Varsayılan: sistem saati. */
  time?: MaybeFn<Date | number | null | undefined>;
  /** IANA time zone ("Europe/Istanbul", "Asia/Tokyo"). Default: the device's. @tr IANA saat dilimi ("Europe/Istanbul", "Asia/Tokyo"). Varsayılan: cihazınki. */
  timeZone?: MaybeFn<string | undefined>;
  /** The second hand: "tick" (jumps once a second with a little spring, default), "smooth" (sweeps) or false (none). @tr Saniye ibresi: "tick" (saniyede bir hafif yaylı atlar, varsayılan), "smooth" (süzülür) ya da false (yok). */
  seconds?: MaybeFn<"tick" | "smooth" | false | undefined>;
  /** Numbers on the dial: "arabic" (1–12, default), "roman" (I–XII), "quarters" (12, 3, 6, 9), "none" or your own `(hour) => text`. @tr Kadrandaki rakamlar: "arabic" (1–12, varsayılan), "roman" (I–XII), "quarters" (12, 3, 6, 9), "none" ya da kendi `(saat) => metin` işleviniz. */
  numerals?: MaybeFn<"arabic" | "roman" | "quarters" | "none" | ((hour: number) => string) | undefined>;
  /** Each hand's look (length, width, tip, tail, colour, class) or false to leave it out: `{ hour: { color: "brand-blue" } }`. @tr Her ibrenin görünümü (uzunluk, genişlik, uç, kuyruk, renk, sınıf) ya da çıkarmak için false: `{ hour: { color: "brand-blue" } }`. */
  hands?: { hour?: ClockHand | false; minute?: ClockHand | false; second?: ClockHand | false } | undefined;
  /** Text on the dial (a city, a brand); false: none. @tr Kadrandaki metin (bir şehir, bir marka); false: yok. */
  caption?: MaybeFn<string | false | undefined>;
  /** A small window under the hub: `(date) => node` (a date, a digital time). Default none. @tr Göbeğin altında küçük bir pencere: `(tarih) => düğüm` (bir tarih, dijital saat). Varsayılan yok. */
  readout?: ((date: Date) => unknown) | false | undefined;
  /** Accessible name before the spoken time. Default "Clock". @tr Okunan saatten önceki erişilebilir ad. Varsayılan "Clock". */
  label?: MaybeFn<string | undefined>;
  /** Width in px. Default 220. @tr px cinsinden genişlik. Varsayılan 220. */
  size?: MaybeFn<number | undefined>;
  /** Theme color token of the second hand. Default "danger". @tr Saniye ibresinin tema renk belirteci. Varsayılan "danger". */
  color?: ColorToken | undefined;
  /** Parts on or off: face, ticks, numbers, hub, glass, caption. @tr Parçalar açık ya da kapalı: face, ticks, numbers, hub, glass, caption. */
  parts?: ClockParts | undefined;
  /** Motion: false (or "none") makes the hands jump (no spring, no sweep); reduced motion does the same. Default true. @tr Hareket: false (ya da "none") ibreleri atlatır (yay yok, süzülme yok); azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Called once a second with the time shown. @tr Saniyede bir, gösterilen zamanla çağrılır. */
  onTick?: ((date: Date) => void) | undefined;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

const ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
/** `<AnalogClock timeZone="Europe/Istanbul" />` */
export function AnalogClock(props: AnalogClockProps): Element {
  // the clock's heartbeat: bumped every second (and every frame while a smooth hand sweeps)
  const tick = secondBeat();
  const date = computed((): Date => { tick.beat(); const x = val(props.time); return x == null ? new Date() : new Date(x); });
  const zone = computed(() => val(props.timeZone) || undefined);
  const parts = computed(() => clockParts(date(), { timeZone: zone() }));
  const mode = computed(() => { const s = val(props.seconds) ?? "tick"; return s === "smooth" && still(props.motion) ? "tick" : s; });

  // hand values on a 0–60 scale, continuous: a hand passing 12 (or a time set back) takes the short way round
  const hand = (raw: () => number) => {
    let last = NaN;
    return computed(() => (last = unwrap(last, raw(), 60)));
  };
  const hourV = hand(() => { const p = parts(); return ((p.hours % 12) + p.minutes / 60 + p.seconds / 3600) * 5; });
  const minuteV = hand(() => { const p = parts(); return p.minutes + p.seconds / 60; });
  const secondV = hand(() => { const p = parts(); return p.seconds + (mode() === "smooth" ? p.ms / 1000 : 0); });

  const needles = computed((): GaugeNeedle[] => {
    const look = props.hands ?? {}, list: GaugeNeedle[] = [];
    if (look.hour !== false) list.push({ length: 0.52, width: 3.4, tip: 2.2, tail: 0.12, ...look.hour, class: cx("m-clock-hour", look.hour?.class), value: hourV, move: "none" });
    if (look.minute !== false) list.push({ length: 0.8, width: 2.5, tip: 1.4, tail: 0.14, ...look.minute, class: cx("m-clock-minute", look.minute?.class), value: minuteV, move: "none" });
    const s = mode();
    if (s !== false && look.second !== false) {
      list.push({ length: 0.88, width: 0.9, tip: 0.6, tail: 0.28, color: props.color ?? "danger", ...look.second,
        class: cx("m-clock-second", look.second?.class), value: secondV, move: s === "tick" ? "spring" : "none" });
    }
    return list;
  });

  const numerals = (v: number): string => {
    const n = val(props.numerals) ?? "arabic", hr = Math.round(v / 5) % 12;
    if (typeof n === "function") return n(hr || 12);
    if (n === "roman") return ROMAN[hr]!;
    if (n === "quarters") return hr % 3 ? "" : String(hr || 12);
    return String(hr || 12);
  };
  const p = props.parts ?? {};
  const gauge = h(Gauge, {
    min: 0, max: 60, sweep: 360, start: 0, wrap: true, get size() { return val(props.size); }, get motion() { return val(props.motion); }, needles,
    ticks: () => ({ step: 5, minor: 4, labels: (val(props.numerals) ?? "arabic") === "none" || p.numbers === false ? false : numerals }),
    caption: () => val(props.caption) ?? false,
    get readout() { const r = props.readout; return typeof r === "function" ? h("span", { class: "m-clock-readout" }, () => r(date())) : false; },
    parts: { face: p.face ?? true, ticks: p.ticks ?? true, labels: p.numbers ?? true, hub: p.hub ?? true, glass: p.glass ?? true, caption: p.caption ?? true, track: false, arc: false, needle: false, peak: false },
  }) as HTMLElement;
  gauge.setAttribute("aria-hidden", "true");

  // ROLE img: the time to the minute, in the page's language (changes once a minute, never floods a screen reader)
  const minute = computed(() => { const x = parts(); return x.hours * 60 + x.minutes; });
  const spoken = computed(() => {
    minute();
    const tz = zone();
    return new Intl.DateTimeFormat(locale(), { hour: "numeric", minute: "2-digit", ...(tz ? { timeZone: tz } : {}) }).format(untrack(date));
  });
  const root = h("div", {
    class: () => cx("m-clock", `m-clock-${mode() || "none"}`, val(props.class)),
    role: "img",
    "aria-label": () => `${val(props.label) ?? t`Clock`}: ${spoken()}`,
  }, gauge) as HTMLElement;

  // TIMER: the shared clock beat (ui/clock.ts: each whole second while on screen); OBSERVE visible
  tick.watch(root, () => props.onTick?.(date()));
  effect(() => {
    if (tick.visible() && mode() === "smooth") onCleanup(onFrame(tick.bump, { phase: "update" }));
  });
  return root;
}
