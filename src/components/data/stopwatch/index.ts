// Stopwatch (march/ui): a chronograph dial: a sweeping seconds hand on a 60-second scale, a 30-minute sub-dial, a
// digital readout, Start / Stop, Lap and Reset buttons and a lap list (best and worst lap marked). It measures real time
// (performance.now), so the global motion speed never slows the time it shows; the hands only show it. On Reset the
// hands fly back to zero on a spring, the short way round.
//   <Stopwatch />   <Stopwatch running={$on} onLap={(lap) => save(lap)} subDial={false} />
import "./stopwatch.css";
import { signal, computed, effect, untrack, onCleanup, batch } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, later, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { whenVisible } from "../../../ui/observe.ts";
import { formatDuration } from "../../../ui/format.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { still } from "../../../motion/engine/parts.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Gauge, unwrap } from "../gauge/index.ts";
import { Button } from "../../actions/button/index.ts";

/** One lap: its own time and the total at its end (ms). @tr Bir tur: kendi süresi ve sonundaki toplam (ms). */
export interface StopwatchLap { lap: number; total: number }
/** The button texts. @tr Düğme metinleri. */
export interface StopwatchTexts { start?: string; stop?: string; resume?: string; lap?: string; reset?: string; lapName?: (n: number) => string }
/** The parts on or off. @tr Parçalar açık ya da kapalı. */
export interface StopwatchParts { face?: boolean; ticks?: boolean; numbers?: boolean; subDial?: boolean; readout?: boolean; glass?: boolean; controls?: boolean; laps?: boolean }

export interface StopwatchProps {
  /** Runs or stops it from outside (a live value); the buttons still work. @tr Dışarıdan çalıştırır ya da durdurur (canlı değer); düğmeler yine çalışır. */
  running?: MaybeFn<boolean | undefined>;
  /** Fraction digits of the seconds in the readout and the lap list (0–3). Default 2. @tr Göstergede ve tur listesinde saniyenin kesir basamakları (0–3). Varsayılan 2. */
  decimals?: MaybeFn<number | undefined>;
  /** The 30-minute sub-dial. Default true. @tr 30 dakikalık alt kadran. Varsayılan true. */
  subDial?: MaybeFn<boolean | undefined>;
  /** The button texts and the lap name: `{ start: "Başlat", lapName: (n) => \`Tur ${n}\` }`. @tr Düğme metinleri ve tur adı: `{ start: "Başlat", lapName: (n) => \`Tur ${n}\` }`. */
  texts?: StopwatchTexts | undefined;
  /** Accessible name of the group. Default "Stopwatch". @tr Grubun erişilebilir adı. Varsayılan "Stopwatch". */
  label?: MaybeFn<string | undefined>;
  /** Width of the dial in px. Default 240. @tr Kadranın px genişliği. Varsayılan 240. */
  size?: MaybeFn<number | undefined>;
  /** Theme color token of the seconds hand. Default "danger". @tr Saniye ibresinin tema renk belirteci. Varsayılan "danger". */
  color?: ColorToken | undefined;
  /** Parts on or off: face, ticks, numbers, subDial, readout, glass, controls, laps. @tr Parçalar açık ya da kapalı: face, ticks, numbers, subDial, readout, glass, controls, laps. */
  parts?: StopwatchParts | undefined;
  /** Motion: false (or "none") makes the hands step ten times a second and jump back on Reset; reduced motion does the same. Default true. @tr Hareket: false (ya da "none") ibreleri saniyede on kez adımlatır ve Sıfırla'da geri atlatır; azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Started (or resumed). @tr Başladı (ya da sürdü). */
  onStart?: ((elapsed: number) => void) | undefined;
  /** Stopped, with the time so far (ms). @tr Durdu, o ana kadarki süreyle (ms). */
  onStop?: ((elapsed: number) => void) | undefined;
  /** A lap was taken. @tr Bir tur alındı. */
  onLap?: ((lap: StopwatchLap, laps: readonly StopwatchLap[]) => void) | undefined;
  /** Reset to zero. @tr Sıfırlandı. */
  onReset?: (() => void) | undefined;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

const clock = (): number => globalThis.performance?.now?.() ?? Date.now();

/** `<Stopwatch onLap={(l) => console.log(l.lap)} />` */
export function Stopwatch(props: StopwatchProps): Element {
  // the parts: read live where a part comes and goes (sub-dial, readout, controls, laps); the dial's own parts once
  const P = (): StopwatchParts => props.parts ?? {};
  const p = P();
  const T = (): StopwatchTexts => props.texts ?? {};
  // STATE: time banked before the current run, the start of the current run, the laps, a frame beat
  const base = signal(0), since = signal<number | null>(null), laps = signal<StopwatchLap[]>([]), beat = signal(0);
  const running = computed(() => since() != null);
  const elapsed = computed(() => { beat(); const s = since(); return base() + (s == null ? 0 : clock() - s); });
  const decimals = computed(() => Math.max(0, Math.min(3, Math.round(val(props.decimals) ?? 2))));
  const text = (ms: number): string => formatDuration(ms, { pad: true, decimals: decimals() });

  const start = (): void => { if (running()) return; since.set(clock()); untrack(() => props.onStart?.(base())); };
  const stop = (): void => { const s = since.peek(); if (s == null) return; batch(() => { base.set(base.peek() + clock() - s); since.set(null); }); untrack(() => props.onStop?.(base.peek())); };
  const lap = (): void => {
    if (!running()) return;
    const total = base.peek() + clock() - since.peek()!, prev = laps.peek().at(-1)?.total ?? 0, l = { lap: total - prev, total };
    laps.set([...laps.peek(), l]);
    untrack(() => props.onLap?.(l, laps.peek()));
  };
  const reset = (): void => { batch(() => { since.set(null); base.set(0); laps.set([]); }); untrack(() => props.onReset?.()); };
  effect(() => { const r = val(props.running); if (r === true) untrack(start); else if (r === false) untrack(stop); });

  // the hands: continuous values on their scales; a reset sends them to the nearest zero (the short way back), and
  // they move on a spring while stopped (the fly-back), frame by frame while running
  const handValue = (per: number, span: number) => {
    let last = NaN;
    return computed(() => { const v = elapsed() / per; return (last = v === 0 ? unwrap(last, 0, span) : v); });
  };
  const seconds = handValue(1000, 60), minutes = handValue(60000, 30);
  const move = (): "none" | "spring" => (running() ? "none" : "spring");
  const sub = computed(() => (P().subDial ?? true) && (val(props.subDial) ?? true));

  const subDial = (): unknown => (sub() ? h("div", { class: "m-stopwatch-sub" }, h(Gauge, {
    min: 0, max: 30, sweep: 360, start: 0, wrap: true, size: 64, get motion() { return val(props.motion); }, class: "m-stopwatch-minutes",
    needles: () => [{ value: minutes, length: 0.86, width: 1.6, tip: 0.8, tail: 0.18, color: props.color ?? "danger", move: move() }],
    ticks: { step: 5, minor: 4, labels: (v: number) => (v % 10 ? "" : String(v || 30)) },
    parts: { face: false, track: false, arc: false, needle: false, peak: false, readout: false, glass: false, hub: true, caption: false },
  })) : null);

  const readoutEl = h("span", { class: "m-stopwatch-readout" }, () => text(elapsed()));
  const gauge = h(Gauge, {
    min: 0, max: 60, sweep: 360, start: 0, wrap: true, size: () => val(props.size) ?? 240, get motion() { return val(props.motion); },
    needles: () => [{ value: seconds, length: 0.9, width: 1.1, tip: 0.7, tail: 0.24, color: props.color ?? "danger", move: move(), class: "m-stopwatch-hand" }],
    ticks: { step: 5, minor: 4, labels: p.numbers === false ? false : (v: number) => String(v || 60) },
    inlay: subDial, get readout() { return P().readout === false ? false : readoutEl; },
    parts: { face: p.face ?? true, ticks: p.ticks ?? true, labels: p.numbers ?? true, glass: p.glass ?? true, track: false, arc: false, needle: false, peak: false, caption: false },
  }) as HTMLElement;
  gauge.setAttribute("aria-hidden", "true");

  // laps: newest first, the best and the worst marked (from two laps on)
  const lapList = (): unknown => {
    if (P().laps === false) return null;
    const all = laps(), times = all.map((l) => l.lap);
    const best = all.length > 1 ? Math.min(...times) : -1, worst = all.length > 1 ? Math.max(...times) : -1;
    const name = (n: number): string => T().lapName?.(n) ?? t`Lap ${n}`;
    return all.length ? h("ol", { class: "m-stopwatch-laps", "aria-label": t`Laps` }, all.map((l, i) => h("li", {
      class: cx("m-stopwatch-lap", l.lap === best && "is-best", l.lap === worst && "is-worst"),
    }, h("span", { class: "m-stopwatch-lap-name" }, name(i + 1)), h("span", { class: "m-stopwatch-lap-time" }, text(l.lap)), h("span", { class: "m-stopwatch-lap-total" }, text(l.total)))).reverse()) : null;
  };

  const controlsEl = h("div", { class: "m-stopwatch-controls" },
    h(Button, { variant: () => (running() ? "secondary" : "primary"), size: "sm", class: "m-stopwatch-toggle", onClick: () => (running() ? stop() : start()) },
      () => (running() ? T().stop ?? t`Stop` : elapsed() > 0 ? T().resume ?? t`Resume` : T().start ?? t`Start`)),
    h(Button, { variant: "ghost", size: "sm", class: "m-stopwatch-second", disabled: () => !running() && elapsed() === 0, onClick: () => (running() ? lap() : reset()) },
      () => (running() ? T().lap ?? t`Lap` : T().reset ?? t`Reset`)));

  // the time to the whole second for screen readers (a timer is not live: it is read when visited); laps are announced
  const whole = computed(() => Math.floor(elapsed() / 1000));
  const root = h("div", {
    class: () => cx("m-stopwatch", running() && "is-running", val(props.class)),
    role: "group", "aria-label": () => val(props.label) ?? t`Stopwatch`,
  }, gauge,
  h("span", { class: "m-sr-only", role: "timer" }, () => formatDuration(whole() * 1000)),
  () => (P().controls === false ? null : controlsEl), h("div", { class: "m-stopwatch-lapbox", "aria-live": "polite" }, lapList)) as HTMLElement;

  // TIMER: while running and on screen, a beat every frame (the hand sweeps) or ten times a second when nothing should
  // move; real time is measured either way, so a pause in motion never loses time
  const visible = signal(false);
  whenVisible(root, (v) => visible.set(v));
  effect(() => {
    if (!running() || !visible()) return;
    if (!still(props.motion)) { onCleanup(onFrame(() => beat.set(beat.peek() + 1), { phase: "update" })); return; }
    let id: ReturnType<typeof setTimeout>;
    const step = (): void => { beat.set(beat.peek() + 1); id = later(step, 100); };
    id = later(step, 100);
    onCleanup(() => clearTimeout(id));
  });
  return root;
}
