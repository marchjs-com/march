// Gauge (march/ui): a dial with a needle, as on a car's instrument cluster, a fine watch or a studio VU meter. An arc
// track with coloured zones and a redline, major and minor ticks with labels, a needle that moves on spring physics
// (or with VU ballistics), a hub, a peak marker and a digital readout (CountRoll, or Odometer drums). The value is a
// number, or the loudness of an audio source (march/audio). Four looks: speedometer (270°), tachometer (×1000, redline),
// half (180°) and vu (a needle VU meter in dB).
//   <Gauge value={$speed} max={240} unit="km/h" />   <Gauge variant="vu" source={audioSource("demo")} />
import "./gauge.css";
import { signal, computed, effect, untrack, onCleanup, getOwner, runWithOwner, type Accessor } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { val, cx, clamp, later, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { still } from "../../../motion/engine/parts.ts";
import { track } from "../../../motion/engine/value.ts";
import { colorAttr, tokenColor, type ColorToken } from "../../../theme/colors.ts";
import type { AudioSourceLike } from "../../../audio/index.ts";
import { CountRoll } from "../../social/count-roll/index.ts";
import { Odometer } from "../odometer/index.ts";

export type GaugeVariant = "speedometer" | "tachometer" | "half" | "vu";
/** A coloured band of the scale. @tr Ölçeğin renkli bir bandı. */
export interface GaugeZone { from: number; to: number; color: ColorToken }
/** Ticks: the major step (or the exact values), minor ticks per major step, labels on / off / your own text. @tr Çentikler: ana adım (ya da tam değerler), ana adım başına ara çentik, etiketler açık / kapalı / kendi metniniz. */
export interface GaugeTicks {
  step?: number | undefined;
  values?: readonly number[] | undefined;
  minor?: number | undefined;
  labels?: boolean | ((v: number) => string) | undefined;
}
/** Each part of the dial on or off. @tr Kadranın her parçası açık ya da kapalı. */
export interface GaugeParts {
  face?: boolean; track?: boolean; arc?: boolean; zones?: boolean; ticks?: boolean; labels?: boolean;
  caption?: boolean; needle?: boolean; hub?: boolean; peak?: boolean; readout?: boolean; glass?: boolean;
}

export interface GaugeProps {
  /** The value (it may be live). Ignored while a `source` is given. @tr Değer (canlı olabilir). Bir `source` verildiğinde yok sayılır. */
  value?: MaybeFn<number | null | undefined>;
  /** An audio source (march/audio: "mic", "demo", an element, a stream, a number 0–1 accessor): the needle shows its loudness (in dB on "vu"). @tr Bir ses kaynağı (march/audio: "mic", "demo", bir öğe, bir akış, 0–1 sayı erişimcisi): ibre ses yüksekliğini gösterir ("vu"da dB olarak). */
  source?: AudioSourceLike | undefined;
  /** Start of the scale. Default 0 (vu: −20 dB). @tr Ölçeğin başı. Varsayılan 0 (vu: −20 dB). */
  min?: MaybeFn<number | undefined>;
  /** End of the scale. Default 100 (tachometer: 8000, vu: +3 dB). @tr Ölçeğin sonu. Varsayılan 100 (tachometer: 8000, vu: +3 dB). */
  max?: MaybeFn<number | undefined>;
  /** Coloured bands of the scale: `[{ from: 0, to: 60, color: "success" }, …]`. @tr Ölçeğin renkli bantları: `[{ from: 0, to: 60, color: "success" }, …]`. */
  zones?: MaybeFn<readonly GaugeZone[] | undefined>;
  /** Where the red zone starts (its ticks and labels turn red; the gauge glows past it); false: none. Default: tachometer 81 % of the scale, vu 0 dB. @tr Kırmızı bölgenin başladığı yer (çentikleri ve etiketleri kırmızıya döner; geçince kadran parlar); false: yok. Varsayılan: tachometer ölçeğin %81'i, vu 0 dB. */
  redline?: MaybeFn<number | false | undefined>;
  /** Peak marker: true holds the highest value seen, a number marks that value. Default false. @tr Tepe işareti: true görülen en yüksek değeri tutar, bir sayı o değeri işaretler. Varsayılan false. */
  peak?: MaybeFn<boolean | number | undefined>;
  /** How long a held peak stays before it falls back to the value (ms); 0: until `peak` is switched off. Default 0. @tr Tutulan tepenin değere geri düşmeden önce kalma süresi (ms); 0: `peak` kapatılana dek. Varsayılan 0. */
  peakHold?: number | undefined;
  /** Accessible name. Default "Gauge". @tr Erişilebilir ad. Varsayılan "Gauge". */
  label?: MaybeFn<string | undefined>;
  /** Unit under the readout and in the spoken value ("km/h", "%"). @tr Göstergenin altındaki ve okunan değerdeki birim ("km/h", "%"). */
  unit?: MaybeFn<string | undefined>;
  /** Text printed on the dial; false: none. Default: tachometer "×1000 r/min", vu "VU". @tr Kadrana basılı metin; false: yok. Varsayılan: tachometer "×1000 r/min", vu "VU". */
  caption?: MaybeFn<string | false | undefined>;
  /** Format of the readout and the spoken value: a function or Intl.NumberFormat options (`{ maximumFractionDigits: 1 }`). Default: rounded, in the page's language. @tr Göstergenin ve okunan değerin biçimi: bir işlev ya da Intl.NumberFormat seçenekleri (`{ maximumFractionDigits: 1 }`). Varsayılan: yuvarlanmış, sayfanın dilinde. */
  format?: ((v: number) => string) | Intl.NumberFormatOptions | undefined;
  /** Look: "speedometer" (270°, default), "tachometer" (×1000 labels, redline), "half" (180°) or "vu" (a needle VU meter). @tr Görünüm: "speedometer" (270°, varsayılan), "tachometer" (×1000 etiketler, kırmızı çizgi), "half" (180°) ya da "vu" (ibreli VU ölçer). */
  variant?: GaugeVariant | undefined;
  /** Width in px. Default 220 (half 240, vu 260). @tr px cinsinden genişlik. Varsayılan 220 (half 240, vu 260). */
  size?: MaybeFn<number | undefined>;
  /** Sweep of the scale in degrees (90–320). Default 270 (half 180, vu 96). @tr Ölçeğin açısı (derece, 90–320). Varsayılan 270 (half 180, vu 96). */
  sweep?: MaybeFn<number | undefined>;
  /** Ticks (see GaugeTicks); false: none. Default: a round step for the scale, 4 minor ticks each. @tr Çentikler (bkz. GaugeTicks); false: yok. Varsayılan: ölçeğe uygun yuvarlak adım, her birinde 4 ara çentik. */
  ticks?: MaybeFn<GaugeTicks | false | undefined>;
  /** How the needle moves: "spring" (physics with a little overshoot, default), "vu" (300 ms VU ballistics) or "none" (jumps). @tr İbrenin hareketi: "spring" (hafif taşan fizik, varsayılan), "vu" (300 ms VU balistiği) ya da "none" (atlar). */
  needle?: "spring" | "vu" | "none" | undefined;
  /** Digital readout: true (a rolling number), "odometer" (number drums), your own node or `(value) => node`; false: none. Default true (vu: false). @tr Sayısal gösterge: true (yuvarlanan sayı), "odometer" (sayı çarkları), kendi düğümünüz ya da `(value) => düğüm`; false: yok. Varsayılan true (vu: false). */
  readout?: boolean | "odometer" | Node | ((value: number) => unknown) | undefined;
  /** Parts on or off: face, track, arc (the value arc), zones, ticks, labels, caption, needle, hub, peak, readout, glass. @tr Parçalar açık ya da kapalı: face, track, arc (değer yayı), zones, ticks, labels, caption, needle, hub, peak, readout, glass. */
  parts?: GaugeParts | undefined;
  /** Theme color token of the needle and the value arc. Default: the accent. @tr İbrenin ve değer yayının tema renk belirteci. Varsayılan: vurgu rengi. */
  color?: ColorToken | undefined;
  /** Motion: false (or "none") puts the needle on the value at once; reduced motion does the same. Default true. @tr Hareket: false (ya da "none") ibreyi hemen değere koyar; azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** A new highest value while `peak` is true. @tr `peak` true iken yeni bir en yüksek değer. */
  onPeak?: ((value: number) => void) | undefined;
  /** The value crossed the redline (true: into the red, false: out of it). @tr Değer kırmızı çizgiyi geçti (true: kırmızıya girdi, false: çıktı). */
  onRedline?: ((on: boolean, value: number) => void) | undefined;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

interface Look { min: number; max: number; sweep: number; size: number; needle: "spring" | "vu" | "none"; readout: boolean; arc: boolean }
const LOOKS: Record<GaugeVariant, Look> = {
  speedometer: { min: 0, max: 100, sweep: 270, size: 220, needle: "spring", readout: true, arc: true },
  tachometer: { min: 0, max: 8000, sweep: 270, size: 220, needle: "spring", readout: true, arc: false },
  half: { min: 0, max: 100, sweep: 180, size: 240, needle: "spring", readout: true, arc: true },
  vu: { min: -20, max: 3, sweep: 96, size: 260, needle: "vu", readout: false, arc: false },
};
const SPRING = { spring: { stiffness: 150, damping: 13 } }, VU = { spring: { stiffness: 380, damping: 34 } };
/** The level a VU meter reads as 0 dB. */
const VU_REF = 0.5;
const VU_TICKS = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
const RAD = Math.PI / 180;

// small numeric helpers of the dial (the chart helpers would bring the charts' stylesheet and pipes along)
const f1 = (v: number): number => Math.round(v * 10) / 10;
const num = (v: unknown): number | null => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));
const attr = <T>(fn: () => T): Accessor<T> => computed(fn);

/** The dial's round tick step (1, 2, 2.5 or 5 times a power of ten) giving about `count` steps, one that ends on the end of the scale when it can (unlike the charts' niceStep, which only rounds). */
export function dialStep(span: number, count: number): number {
  span = Math.abs(span) || 1;
  const raw = span / Math.max(1, count), p = 10 ** Math.floor(Math.log10(raw));
  const all = [p / 10, p, p * 10].flatMap((q) => [1, 2, 2.5, 5].map((m) => m * q));
  const whole = all.filter((s) => { const n = span / s; return Math.abs(n - Math.round(n)) < 1e-6 && n >= count * 0.5 && n <= count * 1.6; });
  const pick = (list: number[], by: (s: number) => number): number => list.reduce((a, b) => (by(b) < by(a) ? b : a));
  return whole.length ? pick(whole, (s) => Math.abs(span / s - count)) : pick(all, (s) => Math.abs(s - raw));
}

/** Dial geometry in viewBox units (200 wide): centre, radius, height, where the readout and the caption sit. */
export function dialGeometry(variant: GaugeVariant, sweep: number): { cx: number; cy: number; r: number; h: number; readY: number; capY: number } {
  if (variant === "vu") return { cx: 100, cy: 152, r: 112, h: 126, readY: 92, capY: 106 };
  if (sweep > 180) return { cx: 100, cy: 100, r: 88, h: 200, readY: 142, capY: 66 };
  return { cx: 100, cy: 100, r: 88, h: 150, readY: 130, capY: 68 };
}

/** `<Gauge value={$speed} max={240} unit="km/h" />` */
export function Gauge(props: GaugeProps): Element {
  const variant: GaugeVariant = props.variant && props.variant in LOOKS ? props.variant : "speedometer";
  const look = LOOKS[variant], vu = variant === "vu", tach = variant === "tachometer";
  const parts = props.parts ?? {};
  const part = (k: keyof GaugeParts, d = true): boolean => parts[k] ?? d;
  const min = computed(() => num(val(props.min)) ?? look.min);
  const max = computed(() => { const m = num(val(props.max)) ?? look.max; return m > min() ? m : min() + 1; });
  const sweep = computed(() => clamp(num(val(props.sweep)) ?? look.sweep, 90, 320));
  const geo = computed(() => dialGeometry(variant, sweep()));
  const owner = getOwner();

  // the value: the prop, or the loudness of a source (SAMPLE audio)
  const level = signal(0);
  const target = computed(() => {
    const raw = props.source != null
      ? (vu ? (level() > 0 ? 20 * Math.log10(level() / VU_REF) : -Infinity) : min() + level() * (max() - min()))
      : num(val(props.value)) ?? min();
    return clamp(raw, min(), max());
  });
  // where a value sits on the scale, 0–1 (a VU scale is linear in voltage, so its dB marks crowd towards the top)
  const frac = (v: number): number => {
    if (!vu) return (v - min()) / (max() - min());
    const lin = (x: number): number => 10 ** (x / 20);
    return (lin(v) - lin(min())) / (lin(max()) - lin(min()));
  };
  const angle = (v: number, peg = 0): number => -sweep() / 2 + clamp(frac(v), -peg, 1 + peg) * sweep();
  const pt = (r: number, a: number): [number, number] => [f1(geo().cx + r * Math.sin(a * RAD)), f1(geo().cy - r * Math.cos(a * RAD))];
  const arc = (r: number, a0: number, a1: number): string => {
    if (a1 - a0 < 0.05) return "";
    const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
    return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };

  // ANIMATE needle: spring physics or VU ballistics on the engine; none under still(motion). A new `needle` builds the
  // follower anew (the old one is disposed with the computed's run)
  const follow = computed(() => {
    const mode = val(props.needle) ?? look.needle;
    return mode === "none" ? null : untrack(() => track(() => target(), mode === "vu" ? VU : SPRING));
  });
  const shown = (): number => { const f = follow(); return f && !still(props.motion) ? f() : target(); };

  const redline = computed((): number | null => {
    const r = val(props.redline);
    if (r === false) return null;
    if (typeof r === "number") return r;
    return tach ? min() + (max() - min()) * 0.8125 : vu ? 0 : null;
  });
  const isRed = computed(() => redline() != null && target() >= redline()!);

  // the spoken value, at most 4 times a second (a live needle would flood a screen reader)
  const spoken = signal(untrack(target));
  let pending = false;
  effect(() => {
    target();
    if (pending) return;
    pending = true;
    runWithOwner(owner, () => later(() => { pending = false; spoken.set(untrack(target)); }, 250));
  });
  // FORMAT number: a function, or Intl options in the page's language (default: whole numbers)
  const fmt = (v: number): string => {
    const f = props.format;
    return typeof f === "function" ? f(v) : new Intl.NumberFormat(locale(), { maximumFractionDigits: 0, ...f }).format(v);
  };
  const valueText = (v: number): string => { const u = val(props.unit); return u ? `${fmt(v)} ${u}` : fmt(v); };

  // STATE peak: the highest value seen (true), or a fixed mark (number)
  const peak = signal<number | null>(null);
  let drop: ReturnType<typeof setTimeout> | null = null;
  effect(() => {
    const p = val(props.peak), v = target();
    untrack(() => {
      if (p == null || p === false) { peak.set(null); return; }
      if (typeof p === "number") { peak.set(clamp(p, min(), max())); return; }
      const cur = peak.peek();
      if (cur != null && v <= cur) return;
      peak.set(v);
      if (cur != null) props.onPeak?.(v);
      if (props.peakHold) {
        if (drop) clearTimeout(drop);
        drop = runWithOwner(owner, () => later(() => { drop = null; if (val(props.peak) === true) peak.set(untrack(target)); }, props.peakHold!));
      }
    });
  });
  // EMIT redline enter / leave
  let wasRed = false;
  effect(() => { const on = isRed(); if (on !== wasRed) { wasRed = on; untrack(() => props.onRedline?.(on, target())); } });

  // ticks: majors (round steps, or the VU marks), minors between them
  const ticks = computed(() => {
    const tk = val(props.ticks);
    if (tk === false) return { major: [] as number[], minor: [] as number[], label: null as ((v: number) => string) | null };
    const o = tk ?? {};
    const lo = min(), hi = max();
    let major: number[];
    let step = 0;
    if (o.values) major = o.values.filter((v) => v >= lo && v <= hi);
    else if (vu) major = VU_TICKS.filter((v) => v >= lo && v <= hi);
    else {
      step = o.step && o.step > 0 ? o.step : tach ? dialStep(hi - lo, 8) : dialStep(hi - lo, sweep() > 180 ? 10 : 6);
      major = [];
      for (let v = Math.ceil(lo / step - 1e-9) * step, i = 0; v <= hi + 1e-9 && i < 80; v += step, i++) major.push(+v.toFixed(6));
    }
    const lead = step ? step / 10 ** Math.floor(Math.log10(step)) : 0;
    const per = o.minor ?? (vu || !step ? 0 : tach ? 1 : lead === 2 ? 3 : 4);
    const minor: number[] = [];
    if (step && per > 0) for (let i = 0; i < major.length - 1; i++) for (let k = 1; k <= per; k++) minor.push(major[i]! + (k * step) / (per + 1));
    const label = o.labels === false ? null : typeof o.labels === "function" ? o.labels
      : tach ? (v: number) => String(+(v / 1000).toFixed(1)) : vu ? (v: number) => (v > 0 ? `+${v}` : String(Math.abs(v))) : (v: number) => String(+v.toFixed(2));
    return { major, minor, label };
  });

  const zones = computed(() => {
    const list = (val(props.zones) ?? []).map((z) => ({ from: clamp(z.from, min(), max()), to: clamp(z.to, min(), max()), color: z.color, red: false }));
    const r = redline();
    if (r != null && r < max()) list.push({ from: Math.max(r, min()), to: max(), color: "danger", red: true });
    return list;
  });

  const R = (): number => geo().r;
  const rot = (a: () => number) => attr(() => `rotate(${f1(a())} ${geo().cx} ${geo().cy})`);
  const tickPath = (vs: readonly number[], r0: number, r1: number): string =>
    vs.map((v) => { const a = angle(v), [x0, y0] = pt(r0, a), [x1, y1] = pt(r1, a); return `M${x0} ${y0}L${x1} ${y1}`; }).join("");
  // ticks inside the band on a round dial; on a VU meter they stand on the arc and the labels sit above it
  const tickR = (): [number, number, number, number] => (vu ? [R(), R() + 9, R() + 5, R() + 18] : [R() - 9, R() - 19, R() - 14, R() - 30]);

  const svg = h("svg", { class: "m-gauge-svg", viewBox: () => `0 0 200 ${geo().h}`, "aria-hidden": "true", focusable: "false" },
    part("track") ? h("path", { class: "m-gauge-track", d: attr(() => arc(vu ? R() : R() - 3, -sweep() / 2, sweep() / 2)) }) : null,
    part("zones") ? h("g", { class: "m-gauge-zones" }, () => zones().map((z) =>
      h("path", { class: cx("m-gauge-zone", z.red && "is-red"), d: arc(vu ? R() + 2.5 : R() - 9.5, angle(z.from), angle(z.to)), style: { stroke: tokenColor(z.color) } }))) : null,
    part("arc", look.arc) ? h("path", { class: "m-gauge-arc", d: attr(() => arc(R() - 3, -sweep() / 2, angle(shown(), 0))) }) : null,
    part("ticks") ? h("g", { class: "m-gauge-ticks" },
      h("path", { class: "m-gauge-tick is-minor", d: attr(() => { const [a, , c] = tickR(); return tickPath(ticks().minor, a, c); }) }),
      h("path", { class: "m-gauge-tick is-major", d: attr(() => { const [a, b] = tickR(); const r = redline(); return tickPath(ticks().major.filter((v) => r == null || v < r), a, b); }) }),
      h("path", { class: "m-gauge-tick is-major is-red", d: attr(() => { const [a, b] = tickR(); const r = redline(); return r == null ? "" : tickPath(ticks().major.filter((v) => v >= r), a, b); }) })) : null,
    part("labels") ? h("g", { class: "m-gauge-labels" }, () => {
      const { major, label } = ticks(), r = redline();
      if (!label) return null;
      return major.map((v) => { const [x, y] = pt(tickR()[3], angle(v)); return h("text", { class: cx("m-gauge-label", r != null && v >= r && "is-red"), x, y, "text-anchor": "middle", "dominant-baseline": "central" }, label(v)); });
    }) : null,
    part("caption") ? () => {
      const c = val(props.caption) ?? (tach ? t`×1000 r/min` : vu ? t`VU` : false);
      return c ? h("text", { class: "m-gauge-caption", x: geo().cx, y: geo().capY, "text-anchor": "middle", "dominant-baseline": "central" }, c) : null;
    } : null,
    part("peak") ? h("path", { class: () => cx("m-gauge-peak", peak() == null && "is-off"),
      d: attr(() => { const { cx: x, cy: y } = geo(), r = vu ? R() + 1 : R() + 1.5; return `M${x} ${f1(y - r + 8)}L${f1(x - 4)} ${f1(y - r)}L${f1(x + 4)} ${f1(y - r)}Z`; }),
      transform: rot(() => angle(peak() ?? min())) }) : null,
    part("needle") ? h("g", { class: "m-gauge-needle", transform: rot(() => angle(shown(), 0.03)) },
      h("path", { d: attr(() => {
        const { cx: x, cy: y } = geo(), tip = vu ? R() + 6 : R() - 8, tail = vu ? 0 : 18, w = vu ? 0.9 : 2.6;
        return `M${f1(x - w)} ${y}L${f1(x - 0.6)} ${f1(y - tip)}L${f1(x + 0.6)} ${f1(y - tip)}L${f1(x + w)} ${y}L${f1(x + w * 1.3)} ${y + tail}L${f1(x - w * 1.3)} ${y + tail}Z`;
      }) })) : null,
    part("hub", !vu) ? h("g", { class: "m-gauge-hub" },
      h("circle", { class: "m-gauge-hub-ring", cx: () => geo().cx, cy: () => geo().cy, r: 11 }),
      h("circle", { class: "m-gauge-hub-cap", cx: () => geo().cx, cy: () => geo().cy, r: 4.5 })) : null);

  // COMPOSE CountRoll (or Odometer drums) for the readout; a live source updates it with the spoken value (4/s)
  const shownValue: Accessor<number> = computed(() => (props.source != null ? spoken() : target()));
  // a new `readout` draws the readout anew
  const readout = (): unknown => {
    const ro = props.readout ?? look.readout;
    return !part("readout") || ro === false ? null : h("div", { class: "m-gauge-readout", "aria-hidden": "true", style: () => ({ top: `${f1((geo().readY / geo().h) * 100)}%` }) },
      ro === "odometer"
        ? h(Odometer, { value: shownValue, digits: () => String(Math.floor(Math.max(Math.abs(max()), Math.abs(min())))).length, size: "sm", motion: props.motion })
        : typeof ro === "function" ? () => (ro as (v: number) => unknown)(shownValue())
        : ro === true ? h(CountRoll, { value: shownValue, formatter: fmt, roll: () => !still(props.motion), duration: 260, class: "m-gauge-value" })
        : ro,
      () => { const u = val(props.unit); return u ? h("span", { class: "m-gauge-unit" }, u) : null; });
  };

  const root = h("div", {
    class: () => cx("m-gauge", `m-gauge-${variant}`, sweep() > 180 && !vu ? "is-round" : "is-flat", !part("face") && "m-gauge-bare", isRed() && "is-redline", val(props.class)),
    role: "meter",
    "data-m-color": () => colorAttr(val(props.color)),
    "aria-label": () => val(props.label) ?? t`Gauge`,
    "aria-valuemin": min, "aria-valuemax": max,
    "aria-valuenow": () => f1(spoken()),
    "aria-valuetext": () => valueText(spoken()),
    style: () => ({ "--m-gauge-w": `${num(val(props.size)) ?? look.size}px`, "--m-gauge-ratio": `200 / ${geo().h}` }),
  }, svg, readout, part("glass") ? h("div", { class: "m-gauge-glass", "aria-hidden": "true" }) : null) as HTMLElement;

  // SAMPLE audio: the needle follows the source while the gauge is on screen; march/audio loads only for a source
  // (LOAD lazily), so a gauge of a plain number never downloads it. A new `source` is followed instead
  // (liveSource: a later source replaces the first, a number stays one source)
  let gone = false;
  onCleanup(() => { gone = true; });
  const hasSource = computed(() => props.source != null);
  effect(() => {
    if (!hasSource()) return;
    const run = getOwner();
    let stale = false;
    onCleanup(() => { stale = true; level.set(0); });
    void import("../../../audio/live.ts").then(({ liveSource }) => {
      if (gone || stale) return;
      runWithOwner(run, () => {
        const source = liveSource(() => props.source);
        effect(() => {
          const src = source();
          if (!src) return;
          untrack(() => { src.use(root); onCleanup(src.onUpdate((s) => level.set(s.level()))); });
        });
      });
    });
  });
  return root;
}
