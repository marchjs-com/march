// FlipClock (march/data): a flip clock, the bedside clock with split number cards. It is Odometer's "flip" look (the
// split cards, rolling through CountRoll on the motion engine) for the hours, the minutes and the seconds, with the
// separators between them and the morning / afternoon flaps (SplitFlap) of a 12-hour clock. The clock only turns the
// time into numbers and keeps the beat: once a second, only while it is on screen. The time is the system clock, a
// time zone's, or your own source (a Date, a timestamp or a live accessor: a countdown, a match clock, a replay).
//   <FlipClock />   <FlipClock timeZone="Asia/Tokyo" hour12 seconds={false} />   <FlipClock time={$t} size="lg" />
import "./flip-clock.css";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { clockParts, secondBeat } from "../../../ui/clock.ts";
import { still } from "../../../motion/engine/parts.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { Odometer } from "../odometer/index.ts";
import { SplitFlap } from "../split-flap/index.ts";

/** The parts of the clock on or off. @tr Saatin parçaları açık ya da kapalı. */
export interface FlipClockParts { separators?: boolean; period?: boolean; frame?: boolean }

export interface FlipClockProps {
  /** Your own time source: a Date, a timestamp (ms) or a live accessor of one. Default: the system clock. @tr Kendi zaman kaynağınız: bir Date, bir zaman damgası (ms) ya da bunun canlı erişimcisi. Varsayılan: sistem saati. */
  time?: MaybeFn<Date | number | null | undefined>;
  /** IANA time zone ("Europe/Istanbul", "Asia/Tokyo"). Default: the device's. @tr IANA saat dilimi ("Europe/Istanbul", "Asia/Tokyo"). Varsayılan: cihazınki. */
  timeZone?: MaybeFn<string | undefined>;
  /** A 12-hour clock with a morning / afternoon flap. Default: the page language's habit. @tr Sabah / öğleden sonra kanatlı 12 saatlik saat. Varsayılan: sayfa dilinin alışkanlığı. */
  hour12?: MaybeFn<boolean | undefined>;
  /** The seconds cards. Default true. @tr Saniye kartları. Varsayılan true. */
  seconds?: MaybeFn<boolean | undefined>;
  /** The separator between the groups; false: none. Default ":". @tr Gruplar arasındaki ayraç; false: yok. Varsayılan ":". */
  separator?: MaybeFn<string | false | undefined>;
  /** The separators blink once a second. Default true. @tr Ayraçlar saniyede bir yanıp söner. Varsayılan true. */
  blink?: MaybeFn<boolean | undefined>;
  /** Size of the cards: "sm", "md" (default), "lg", or the card height in px. @tr Kartların boyutu: "sm", "md" (varsayılan), "lg" ya da px cinsinden kart yüksekliği. */
  size?: MaybeFn<"sm" | "md" | "lg" | number | undefined>;
  /** Theme color token of the digits. Default: the cards' white ink. @tr Rakamların tema renk belirteci. Varsayılan: kartların beyaz mürekkebi. */
  color?: MaybeFn<ColorToken | undefined>;
  /** Flip time of a card (ms). Default 420. @tr Bir kartın dönme süresi (ms). Varsayılan 420. */
  duration?: number | undefined;
  /** Accessible name before the spoken time. Default "Clock". @tr Okunan saatten önceki erişilebilir ad. Varsayılan "Clock". */
  label?: MaybeFn<string | undefined>;
  /** Parts on or off: separators, period (the 12-hour flap), frame (the housing). @tr Parçalar açık ya da kapalı: separators (ayraçlar), period (12 saat kanadı), frame (gövde). */
  parts?: MaybeFn<FlipClockParts | undefined>;
  /** Motion: false (or "none") changes the cards at once and stops the blinking; reduced motion does the same. Default true. @tr Hareket: false (ya da "none") kartları hemen değiştirir ve yanıp sönmeyi durdurur; azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Called once a second with the time shown. @tr Saniyede bir, gösterilen zamanla çağrılır. */
  onTick?: ((date: Date) => void) | undefined;
  /** Extra class on the root (`m-flipclock`). @tr Köke (`m-flipclock`) eklenen sınıf. */
  class?: ClassProp;
}

/** Whether the page's language writes a 12-hour clock. */
const habit12 = (lang: string): boolean => {
  try { return new Intl.DateTimeFormat(lang, { hour: "numeric" }).resolvedOptions().hour12 === true; } catch { return false; }
};

/** `<FlipClock timeZone="Europe/Istanbul" />` */
export function FlipClock(props: FlipClockProps): Element {
  // the heartbeat: bumped once a second while the clock is on screen
  const tick = secondBeat();
  const date = computed((): Date => { tick.beat(); const x = val(props.time); return x == null ? new Date() : new Date(x); });
  const twelve = computed(() => val(props.hour12) ?? habit12(locale()));
  const now = computed(() => clockParts(date(), { timeZone: val(props.timeZone) || undefined, hour12: twelve(), lang: locale() }));
  const parts = (): FlipClockParts => val(props.parts) ?? {};
  const showSeconds = (): boolean => val(props.seconds) ?? true;
  // the card height in px (the named sizes are a clock's, larger than a counter's)
  const px = (): number => { const s = val(props.size) ?? "md"; return typeof s === "number" ? s : s === "sm" ? 24 : s === "lg" ? 64 : 40; };

  // COMPOSE Odometer (flip): two cards per group; the cards roll through CountRoll on the motion engine
  const group = (cl: string, v: () => number): Element => h(Odometer, {
    value: v, digits: 2, variant: "flip", frame: false, class: cl,
    get size() { return px(); }, get motion() { return val(props.motion); },
    get duration() { return props.duration ?? 420; },
  }) as Element;
  const sep = (): unknown => {
    const s = val(props.separator) ?? ":";
    return s === false || parts().separators === false ? null : h("span", { class: "m-flipclock-sep" }, s);
  };
  const cards = h("span", { class: "m-flipclock-cards", "aria-hidden": "true" },
    group("m-flipclock-h", () => now().hours), sep, group("m-flipclock-m", () => now().minutes),
    () => (showSeconds() ? [sep(), group("m-flipclock-s", () => now().seconds)] : null),
    // COMPOSE SplitFlap: the day period of a 12-hour clock flips its letters (the page language's AM / PM text)
    () => (twelve() && parts().period !== false
      ? h(SplitFlap, { value: () => now().period, length: () => Math.max(2, [...now().period].length), class: "m-flipclock-period", get size() { return Math.round(px() * 0.5); }, get motion() { return val(props.motion); }, frame: false })
      : null));

  // ROLE img: the time to the minute in the page's language (changes once a minute, never floods a screen reader)
  const minute = computed(() => { const x = now(); return `${x.hours}:${x.minutes}:${x.period}`; });
  const spoken = computed(() => {
    minute();
    const tz = val(props.timeZone) || undefined;
    return new Intl.DateTimeFormat(locale(), { hour: "numeric", minute: "2-digit", hour12: twelve(), ...(tz ? { timeZone: tz } : {}) }).format(untrack(date));
  });
  const root = h("div", {
    class: () => cx("m-flipclock", parts().frame === false && "m-flipclock-bare", (val(props.blink) ?? true) && !still(props.motion) && "is-blink", now().seconds % 2 === 1 && "is-odd", val(props.class)),
    role: "img",
    "data-m-color": () => colorAttr(val(props.color)),
    "aria-label": () => `${val(props.label) ?? t`Clock`}: ${spoken()}`,
    style: () => ({ "--m-flipclock-h": `${px()}px` }),
  }, cards) as HTMLElement;

  // TIMER: the shared clock beat (ui/clock.ts: each whole second while on screen); OBSERVE visible
  tick.watch(root, () => props.onTick?.(date()));
  return root;
}
