// LevelMeter (march/data): an LED segment meter, the column of lights on a studio console. It shows a number
// (`value`, 0–1 or min…max, one or two channels) or a live sound (`source`: a microphone, an <audio>, a stream, a
// number; see march/audio), green / amber / red zones, a peak light that holds then falls, and a latched clip light
// that resets on press. The segments are built once: a reading only writes a CSS variable (the lit count) and moves
// one "peak" class, so a meter running at 60 frames a second creates no nodes. Each channel is a `meter` for screen
// readers, updated at most four times a second.
import "./level-meter.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack, onCleanup, type Signal } from "../../../core/reactive.ts";
import { t, locale } from "../../../core/i18n.ts";
import { val, cx, clamp, later, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { onFrame, mutate, now } from "../../../motion/engine/clock.ts";
import { still } from "../../../motion/engine/parts.ts";
import { toAudioSource, type AudioSourceLike } from "../../../audio/index.ts";
import { tokenColor, type ColorToken } from "../../../theme/colors.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";

export interface LevelMeterProps {
  /** The level: one number, or one per channel (`[left, right]`), from `min` to `max` (default 0–1). May be live. @tr Düzey: bir sayı ya da kanal başına bir sayı (`[sol, sağ]`), `min`'den `max`'a (varsayılan 0–1). Canlı olabilir. */
  value?: MaybeFn<number | readonly number[] | null | undefined>;
  /** A live sound instead of `value`: an AudioSource or what makes one ("mic", "demo", an <audio>, a MediaStream, a number accessor). @tr `value` yerine canlı bir ses: bir AudioSource ya da onu yapan şey ("mic", "demo", bir <audio>, bir MediaStream, bir sayı erişimcisi). */
  source?: AudioSourceLike | undefined;
  /** 1 (mono) or 2 (stereo, left and right). Default: 2 with a `source` or a two-number `value`, else 1. @tr 1 (tek kanal) ya da 2 (stereo, sol ve sağ). Varsayılan: `source` ya da iki sayılı `value` ile 2, yoksa 1. */
  channels?: 1 | 2 | undefined;
  /** The lowest value (default 0). @tr En düşük değer (varsayılan 0). */
  min?: MaybeFn<number | undefined>;
  /** The highest value (default 1). @tr En yüksek değer (varsayılan 1). */
  max?: MaybeFn<number | undefined>;
  /** "vertical" (default, fills upward) or "horizontal" (fills from the inline start; mirrored right to left). @tr "vertical" (varsayılan, yukarı dolar) ya da "horizontal" (satır başından dolar; sağdan sola yazında aynalanır). */
  orientation?: MaybeFn<"vertical" | "horizontal" | undefined>;
  /** Number of LED segments. Default 24. @tr LED parçası sayısı. Varsayılan 24. */
  segments?: MaybeFn<number | undefined>;
  /** Where the amber and the red zones start, as fractions of the meter (0–1). Default [0.7, 0.9]. @tr Amber ve kırmızı bölgelerin başladığı yer, ölçerin kesri olarak (0–1). Varsayılan [0.7, 0.9]. */
  zones?: MaybeFn<readonly [number, number] | undefined>;
  /** Theme color tokens of the three zones. Default ["success", "warn", "danger"]. @tr Üç bölgenin tema renk belirteçleri. Varsayılan ["success", "warn", "danger"]. */
  colors?: MaybeFn<readonly [ColorToken, ColorToken, ColorToken] | undefined>;
  /** "linear" (default: the value as it is) or "db" (decibels from `floor` to 0 dBFS, as studio meters read). @tr "linear" (varsayılan: değer olduğu gibi) ya da "db" (`floor`'dan 0 dBFS'ye desibel, stüdyo ölçerleri gibi). */
  scale?: MaybeFn<"linear" | "db" | undefined>;
  /** The bottom of the "db" scale in dB. Default -48. @tr "db" ölçeğinin dibi (dB). Varsayılan -48. */
  floor?: MaybeFn<number | undefined>;
  /** A scale beside the bars: true (default marks) or your marks (dB on the "db" scale, else in min…max). Default false. @tr Çubukların yanında bir ölçek: true (varsayılan işaretler) ya da kendi işaretlerin ("db" ölçeğinde dB, yoksa min…max içinde). Varsayılan false. */
  ticks?: MaybeFn<boolean | readonly number[] | undefined>;
  /** Text of a scale mark. Default: the number in the active locale. @tr Bir ölçek işaretinin metni. Varsayılan: etkin dilde sayı. */
  tickFormat?: ((mark: number) => string) | undefined;
  /** Peak light: how long it holds (ms) before it falls; false for none. Default 1500. @tr Tepe ışığı: düşmeden önce ne kadar kalır (ms); yoksa false. Varsayılan 1500. */
  peakHold?: MaybeFn<number | false | undefined>;
  /** Clip light: true (lights at 0.99 of the range), a threshold (0–1 of the range) or false for none. It stays on until pressed. Default true. @tr Kırpılma ışığı: true (aralığın 0,99'unda yanar), bir eşik (aralığın 0–1'i) ya da yoksa false. Basılana dek yanık kalır. Varsayılan true. */
  clip?: MaybeFn<boolean | number | undefined>;
  /** Called when a channel clips (0 = left / mono, 1 = right). @tr Bir kanal kırpıldığında çağrılır (0 = sol / tek, 1 = sağ). */
  onClip?: ((channel: number) => void) | undefined;
  /** Called when the clip light is pressed (it goes off). @tr Kırpılma ışığına basıldığında çağrılır (söner). */
  onClipReset?: (() => void) | undefined;
  /** Channel letters under the bars: true (L / R in stereo, none in mono), your own texts, or false. Default true. @tr Çubukların altındaki kanal harfleri: true (stereoda L / R, tek kanalda yok), kendi metinlerin ya da false. Varsayılan true. */
  labels?: MaybeFn<boolean | readonly string[] | undefined>;
  /** Accessible name. Default "Level". @tr Erişilebilir ad. Varsayılan "Level". */
  label?: MaybeFn<string | undefined>;
  /** Spoken channel names in stereo. Default ["left", "right"]. @tr Stereoda okunan kanal adları. Varsayılan ["left", "right"]. */
  channelNames?: MaybeFn<readonly [string, string] | undefined>;
  /** Name of the clip light's button. Default "Reset clip". @tr Kırpılma ışığı düğmesinin adı. Varsayılan "Reset clip". */
  clipLabel?: MaybeFn<string | undefined>;
  /** The spoken value of a channel. Default: "-12 dB" on the "db" scale, a percent on "linear". @tr Bir kanalın okunan değeri. Varsayılan: "db" ölçeğinde "-12 dB", "linear"da yüzde. */
  format?: ((level: number, channel: number) => string) | undefined;
  /** "console" (default: a dark housing with glowing LEDs, in every theme) or "flat" (the page's surfaces, no glow). @tr "console" (varsayılan: her temada parlayan LED'li koyu gövde) ya da "flat" (sayfanın yüzeyleri, parıltısız). */
  variant?: MaybeFn<"console" | "flat" | undefined>;
  /** Bar thickness: sm, md (default) or lg. @tr Çubuk kalınlığı: sm, md (varsayılan) ya da lg. */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** Bar length: px or a CSS length. Default 10rem vertical, the full width horizontal. @tr Çubuk uzunluğu: px ya da bir CSS uzunluğu. Varsayılan dikeyde 10rem, yatayda tam genişlik. */
  length?: MaybeFn<number | string | undefined>;
  /** Gap between segments in px. Default 2. @tr Parçalar arası boşluk (px). Varsayılan 2. */
  gap?: MaybeFn<number | undefined>;
  /** Motion: false keeps the peak from falling (it jumps) and the LEDs from fading. Reduced motion does the same. @tr Hareket: false tepe ışığının düşmesini (atlar) ve LED'lerin sönerek kapanmasını durdurur. Azaltılmış hareket de aynısını yapar. */
  motion?: MaybeFn<boolean | undefined>;
  /** Extra class on the root (`m-lm`). @tr Köke (`m-lm`) eklenen sınıf. */
  class?: ClassProp;
}

/** dB marks shown by `ticks` on the "db" scale (those above the floor). */
const DB_MARKS = [0, -3, -6, -12, -18, -24, -36, -48, -60, -72];
/** Peak fall speed: the fraction of the meter per second. */
const FALL = 0.6;
/** Screen readers hear a channel at most once per this many ms. */
const SPEAK_MS = 250;

interface Channel {
  meter: HTMLElement;
  segs: HTMLElement[];
  lit: number;
  /** display position 0–1 of the current reading */
  pos: number;
  /** the input level 0–1 of the current reading (before the scale) */
  level: number;
  peak: number;
  peakAt: number;
  peakSeg: number;
  clipped: Signal<boolean>;
  spokeAt: number;
  speakTimer: ReturnType<typeof setTimeout> | null;
}

const perf = (): number => globalThis.performance?.now?.() ?? Date.now();

/** `<LevelMeter value={$level} />` · `<LevelMeter source={mic} scale="db" ticks />` (stereo) */
export function LevelMeter(props: LevelMeterProps): Element {
  const first = untrack(() => val(props.value));
  const count = props.channels ?? (props.source != null || (Array.isArray(first) && first.length > 1) ? 2 : 1);
  const n = (): number => Math.max(2, Math.round(val(props.segments) ?? 24));
  const vertical = (): boolean => val(props.orientation) !== "horizontal";
  const db = (): boolean => val(props.scale) === "db";
  const floor = (): number => Math.min(-1, val(props.floor) ?? -48);
  const lo = (): number => val(props.min) ?? 0, hi = (): number => val(props.max) ?? 1;
  const clipAt = (): number | null => { const c = val(props.clip) ?? true; return c === false ? null : c === true ? 0.99 : clamp(c, 0, 1); };
  // input level (0–1 linear) → place on the meter (0–1)
  const place = (x: number): number => (!db() ? x : x <= 0 ? 0 : clamp((20 * Math.log10(x) - floor()) / -floor(), 0, 1));
  const chans: Channel[] = [];
  let gone = false;
  onCleanup(() => { gone = true; for (const c of chans) if (c.speakTimer) clearTimeout(c.speakTimer); });

  const spoken = (c: Channel, i: number): string => {
    if (props.format) return props.format(c.level, i);
    locale();
    if (db()) return c.level <= 0 ? t`silent` : `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(20 * Math.log10(c.level))} dB`;
    return new Intl.NumberFormat(locale(), { style: "percent", maximumFractionDigits: 0 }).format(c.pos);
  };
  // the meter's ARIA value, at most four times a second (the last reading always lands)
  const speak = (c: Channel, i: number): void => {
    const write = (): void => {
      c.speakTimer = null; if (gone) return;
      c.spokeAt = perf();
      c.meter.setAttribute("aria-valuenow", String(Math.round(c.pos * 100)));
      c.meter.setAttribute("aria-valuetext", spoken(c, i));
    };
    const since = perf() - c.spokeAt;
    if (since >= SPEAK_MS) write(); else if (!c.speakTimer) c.speakTimer = later(write, SPEAK_MS - since);
  };

  let lastT = -1;
  /** One reading: lit counts, peaks, clip lights, ARIA. Returns true while a peak still has to fall. */
  function apply(levels: readonly number[], time: number): boolean {
    const segs = n(), hold = val(props.peakHold) ?? 1500, at = clipAt(), calm = still(props.motion);
    const dt = lastT < 0 ? 0 : Math.max(0, time - lastT); lastT = time;
    let falling = false;
    chans.forEach((c, i) => {
      const x = clamp(levels[i] ?? levels[0] ?? 0, 0, 1), p = place(x);
      c.level = x; c.pos = p;
      const lit = Math.round(p * segs);
      if (lit !== c.lit) { c.lit = lit; c.meter.style.setProperty("--m-lm-lit", String(lit)); }
      if (hold !== false) {
        if (p >= c.peak) { c.peak = p; c.peakAt = time; }
        else if (time - c.peakAt >= hold) c.peak = calm ? p : Math.max(p, c.peak - (FALL * dt) / 1000);
        if (c.peak > p) falling = true;
        const seg = c.peak > 0 ? Math.max(1, Math.round(c.peak * segs)) - 1 : -1;
        if (seg !== c.peakSeg) { c.segs[c.peakSeg]?.classList.remove("is-peak"); c.segs[seg]?.classList.add("is-peak"); c.peakSeg = seg; }
      }
      if (at != null && x >= at && !c.clipped.peek()) { c.clipped.set(true); props.onClip?.(i); }
      speak(c, i);
    });
    return falling;
  }

  // ---- the parts
  const names = (): readonly string[] => val(props.channelNames) ?? [t`left`, t`right`];
  const letters = (): readonly string[] => { const l = val(props.labels) ?? true; return l === false ? [] : l === true ? (count === 2 ? [t`L`, t`R`] : []) : l; };
  const zone = (k: number, segs: number): string => {
    const [a, b] = val(props.zones) ?? [0.7, 0.9], f = (k + 0.5) / segs;
    return f >= b ? "is-high" : f >= a ? "is-mid" : "is-low";
  };
  const resetClip = (): void => { for (const c of chans) c.clipped.set(false); props.onClipReset?.(); };
  const column = (i: number): Element => {
    const clipped = signal(false);
    const c: Channel = { meter: null as unknown as HTMLElement, segs: [], lit: 0, pos: 0, level: 0, peak: 0, peakAt: 0, peakSeg: -1, clipped, spokeAt: -1e9, speakTimer: null };
    chans[i] = c;
    const name = (): string => { const l = val(props.label) ?? t`Level`; return count === 2 ? `${l}, ${names()[i] ?? i + 1}` : l; };
    const bar = h("span", { class: "m-lm-bar", "aria-hidden": "true" }, () => {
      const segs = n();
      // rebuilt only when the count or the zones change; readings never touch these nodes
      c.segs = Array.from({ length: segs }, (_, k) => h("span", { class: `m-lm-seg ${zone(k, segs)}`, style: { "--i": k } }) as HTMLElement);
      c.peakSeg = -1;
      return c.segs;
    });
    c.meter = h("div", { class: "m-lm-meter", role: "meter", "aria-label": name, "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0" }, bar) as HTMLElement;
    return h("div", { class: "m-lm-ch" },
      () => clipAt() == null ? null : h(IconButton, {
        class: () => cx("m-lm-clip", clipped() && "is-on"), size: "xs", shape: "round",
        label: () => val(props.clipLabel) ?? t`Reset clip`, pressed: clipped, onClick: resetClip,
      }, h(StatusDot, { tone: () => (clipped() ? "danger" : "neutral"), size: "sm" })),
      c.meter,
      () => { const l = letters()[i]; return l ? h("span", { class: "m-lm-label", "aria-hidden": "true" }, l) : null; });
  };
  const scale = (): Element | null => {
    const tk = val(props.ticks);
    if (!tk) return null;
    const marks = tk === true ? (db() ? DB_MARKS.filter((d) => d >= floor()) : [0, 0.25, 0.5, 0.75, 1].map((f) => lo() + f * (hi() - lo()))) : tk;
    const fmt = props.tickFormat ?? ((m: number) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(m));
    return h("div", { class: "m-lm-scale", "aria-hidden": "true" }, marks.map((m) => {
      const f = db() ? (m - floor()) / -floor() : (m - lo()) / (hi() - lo() || 1);
      return f < 0 || f > 1 ? null : h("span", { class: "m-lm-tick", style: { "--p": f } }, fmt(m));
    }));
  };
  const columns = Array.from({ length: count }, (_, i) => column(i));
  const root = h("div", {
    class: () => cx("m-lm", vertical() ? "m-lm-v" : "m-lm-h", `m-lm-${val(props.size) ?? "md"}`, val(props.variant) === "flat" ? "m-lm-flat" : "m-lm-console", still(props.motion) && "is-still", val(props.class)),
    style: () => {
      const [c1, c2, c3] = val(props.colors) ?? ["success", "warn", "danger"];
      const len = val(props.length);
      return { "--m-lm-n": n(), "--m-lm-gap": `${val(props.gap) ?? 2}px`, "--m-lm-len": len == null ? null : typeof len === "number" ? `${len}px` : len,
        "--m-lm-c1": tokenColor(c1), "--m-lm-c2": tokenColor(c2), "--m-lm-c3": tokenColor(c3) };
    },
  }, scale, columns) as HTMLElement;

  // ---- readings
  const norm = (v: number): number => (Number.isFinite(v) ? clamp((v - lo()) / (hi() - lo() || 1), 0, 1) : 0);
  if (props.source != null) {
    // SAMPLE audio: the source reads on the clock while the meter is on screen; the DOM is written in the write phase
    const src = toAudioSource(props.source);
    src.use(root);
    let queued = false, levels: readonly number[] = [0, 0];
    onCleanup(src.onUpdate((s) => {
      levels = count === 2 ? s.channels() : [s.level()];
      if (!queued) { queued = true; mutate(() => { queued = false; if (!gone) apply(levels, now()); }); }
    }));
  } else {
    // a value: draw on change; the clock runs only while a peak falls
    let levels: readonly number[] = [0], fall: (() => void) | null = null;
    const settle = (): void => {
      if (fall || gone) return;
      fall = onFrame((time) => { if (!apply(levels, time)) { fall?.(); fall = null; } }, { phase: "write" });
    };
    onCleanup(() => fall?.());
    effect(() => {
      const v = val(props.value);
      const list = (Array.isArray(v) ? v : [v ?? 0]).map((x) => norm(Number(x)));
      n(); val(props.scale); val(props.floor); // a new scale redraws the same value
      untrack(() => { levels = list; if (apply(levels, now())) settle(); });
    });
  }
  return root;
}
