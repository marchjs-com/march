// Stat: a KPI box with a delta arrow and an optional sparkline (march/charts). Folder: src/components/data/stat/; shared chart parts (scales, axes, tooltip, data table,
// formats) are in src/charts/.
import "./stat.css";
import { computed, read, reactive } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { svgIcon, isIconDef } from "../../../icons/svg.ts";
import { formatter, num, type MaybeReactive, type DataProp, type Field, type FormatSpec } from "../../../charts/util.ts";
import { StatTile } from "../stat-tile/index.ts";
import { Sparkline } from "../sparkline/index.ts";
import { tween, animateOf, type AnimateProp } from "../../../charts/motion.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

export interface StatProps<D = unknown> {
  /** The label over the value. @tr Değerin üstündeki etiket. */
  label?: Opt<unknown>;
  /** The value, formatted with `format`. @tr `format` ile biçimlenen değer. */
  value?: Opt<unknown>;
  /** The previous value; computes `delta = (value − previous) / |previous|` when `delta` is not given. @tr Önceki değer; `delta` verilmezse `delta = (value − previous) / |previous|` hesaplanır. */
  previous?: Opt<number>;
  /** Change as a fraction (0.12 → +12%), shown with an arrow. @tr Kesir olarak değişim (0.12 → +%12), okla gösterilir. */
  delta?: Opt<number>;
  /** Value format: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Format of |delta| (default `["percent", 1]`). @tr |delta| biçimi (varsayılan `["percent", 1]`). */
  deltaFormat?: Opt<FormatSpec>;
  /** A decrease is good (costs, latency). @tr Azalma iyidir (maliyet, gecikme). */
  invert?: Opt<boolean>;
  /** Text after the delta, e.g. "vs last week". @tr Değişimden sonraki metin, ör. "geçen haftaya göre". */
  hint?: Opt<unknown>;
  /** Shown when there is no value (default "—"). @tr Değer yokken gösterilir (varsayılan "—"). */
  empty?: Opt<unknown>;
  /** Extra CSS classes on the root. @tr Köke eklenen ek CSS sınıfları. */
  class?: Opt<string>;
  /** Data for an inline sparkline under the value. @tr Değerin altındaki küçük eğilim çizgisinin verisi. */
  spark?: DataProp<D>;
  /** The value of a sparkline row: a key or getter. @tr Eğilim çizgisi satırının değeri: bir anahtar ya da getter. */
  sparkY?: Field<D> | undefined;
  /** An icon (march/icons) shown next to the label. @tr Etiketin yanında gösterilen ikon (march/icons). */
  icon?: unknown;
  /**
   * Change animation: the value counts to its new number (formatted every frame), the delta arrow turns to its new
   * direction and the sparkline morphs. `true` (default: a spring), `false`, an easing name or
   * `{ duration, easing, delay, enter, update }`; `{ enter: false }` keeps the first value from counting up from 0.
   * @tr Değişim animasyonu: değer yeni sayısına sayarak gider (her karede biçimlenir), değişim oku yeni yönüne döner ve
   * eğilim çizgisi dönüşür. `true` (varsayılan: yay), `false`, bir easing adı ya da `{ duration, easing, delay, enter,
   * update }`; `{ enter: false }` ilk değerin 0'dan sayarak gelmesini kapatır.
   */
  animate?: AnimateProp | (() => AnimateProp);
}

/** value / previous / delta: a value, a signal or a plain getter `() => number` (all three are allowed by the types). */
const val = <T>(v: MaybeReactive<T>): T => (typeof v === "function" ? (v as () => T)() : v);

type Dir = "up" | "down" | "flat";
/** The arrow is one "↑" turned: up 0°, no change 90° (→), down 180°; a change of direction turns it. */
const TURN: Record<Dir, number> = { up: 0, flat: 90, down: 180 };
/** Decimals of a number as written (2.50 → 1, 1e-7 → 7), so a counting value never shows more digits than its target. */
const decimals = (v: number): number => { const s = String(v), e = s.indexOf("e-"); return e > 0 ? Number(s.slice(e + 2)) : (s.split(".")[1]?.length ?? 0); };
const roundTo = (v: number, d: number): number => { const k = 10 ** Math.min(d, 10); return Math.round(v * k) / k; };
const SAY: Record<Dir, string> = { up: "Up ", down: "Down ", flat: "No change " };

/**
 * KPI box: label, formatted value, delta (fraction by default: 0.12 → "+12%") with an arrow, optional sparkline.
 * `previous` computes the delta; `invert` marks a decrease as good (e.g. costs); `deltaFormat` formats |delta|.
 */
export function Stat<D>(props: StatProps<D>): Element {
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const delta = computed(() => {
    const d = num(val(props.delta));
    if (d != null) return d;
    const v = num(val(props.value)), p = num(val(props.previous));
    return v != null && p ? (v - p) / Math.abs(p) : null;
  });
  const dir = computed((): Dir | null => { const d = delta(); return d == null ? null : d > 0 ? "up" : d < 0 ? "down" : "flat"; });
  const deltaText = (): string => {
    const d = delta() as number, f = formatter(read<FormatSpec | null | undefined>(props.deltaFormat), (v) => formatter(["percent", 1])(v));
    return `${d > 0 ? "+" : d < 0 ? "−" : ""}${f(Math.abs(d))}`;
  };
  const how = (): AnimateProp => animateOf(props.animate);
  // the value counts from what is shown to the new number (on the engine); the first value counts up from 0
  const target = computed(() => num(val(props.value)));
  const counted = tween(() => ({ v: target() ?? 0 }), ["v"], how, () => ({ v: 0 }));
  const shownValue = (): unknown => {
    const v = val(props.value), n = target();
    if (v == null) return read(props.empty) ?? "—";
    if (n == null || typeof v !== "number") return fmt()(v);
    const c = counted().v;
    return fmt()(c === n ? n : roundTo(c, decimals(n)));
  };
  const turn = tween(() => ({ a: TURN[dir() ?? "flat"] }), ["a"], how);
  const hasDelta = computed(() => dir() != null);
  const hasSpark = computed(() => !!read(props.spark as MaybeReactive<unknown>));
  const tone = (): string => { const d = dir(); if (!d || d === "flat") return "m-stat-neutral"; return (d === "up") !== !!read(props.invert) ? "m-stat-good" : "m-stat-bad"; };
  return h("div", { class: () => ["m-stat", read(props.class)].filter(Boolean).join(" ") },
    // label over value: the StatTile of march/data (one drawing of the tile); the delta pill and the sparkline are the chart's own
    h(StatTile, {
      align: "start", order: "label", partClass: { label: "m-stat-label", value: "m-stat-value" },
      label: [isIconDef(props.icon) ? h("span", { class: "m-stat-icon", "aria-hidden": "true" }, svgIcon(props.icon)) : null, h("span", {}, () => read(props.label) ?? "")],
      value: shownValue,
    }),
    () => (hasDelta() ? h("div", { class: () => `m-stat-delta m-stat-${dir()} ${tone()}` },
      h("span", { class: "m-stat-arrow", "aria-hidden": "true", style: () => ({ transform: `rotate(${Math.round(turn().a)}deg)` }) }, "↑"),
      h("span", { class: "m-sr-only" }, () => SAY[dir() as Dir]),
      h("span", { class: "m-stat-delta-value" }, deltaText),
      () => (read(props.hint) ? h("span", { class: "m-stat-hint" }, ` ${read(props.hint)}`) : null)) : null),
    () => (hasSpark() ? h(Sparkline, { data: reactive(() => read(props.spark as MaybeReactive<Iterable<D> | null | undefined>)), y: props.sparkY, width: 240, height: 40, area: true, title: reactive(() => read(props.label) as string | null | undefined), animate: () => how() }) : null));
}
