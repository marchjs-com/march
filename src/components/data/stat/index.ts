// Stat: a KPI box with a delta arrow and an optional sparkline (march/charts). Folder: src/components/data/stat/; shared chart parts (scales, axes, tooltip, data table,
// formats) are in src/charts/.
import "./stat.css";
import { computed, read, reactive } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { svgIcon, isIconDef } from "../../../icons/svg.ts";
import { formatter, num, type MaybeReactive, type DataProp, type Field, type FormatSpec } from "../../../charts/util.ts";
import { StatTile } from "../stat-tile/index.ts";
import { Sparkline } from "../sparkline/index.ts";

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
}

type Dir = "up" | "down" | "flat";
const ARROWS: Record<Dir, string> = { up: "↑", down: "↓", flat: "–" };
const SAY: Record<Dir, string> = { up: "Up ", down: "Down ", flat: "No change " };

/**
 * KPI box: label, formatted value, delta (fraction by default: 0.12 → "+12%") with an arrow, optional sparkline.
 * `previous` computes the delta; `invert` marks a decrease as good (e.g. costs); `deltaFormat` formats |delta|.
 */
export function Stat<D>(props: StatProps<D>): Element {
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const delta = computed(() => {
    const d = num(read(props.delta));
    if (d != null) return d;
    const v = num(read(props.value)), p = num(read(props.previous));
    return v != null && p ? (v - p) / Math.abs(p) : null;
  });
  const dir = computed((): Dir | null => { const d = delta(); return d == null ? null : d > 0 ? "up" : d < 0 ? "down" : "flat"; });
  const deltaText = (): string => {
    const d = delta() as number, f = formatter(read<FormatSpec | null | undefined>(props.deltaFormat), (v) => formatter(["percent", 1])(v));
    return `${d > 0 ? "+" : d < 0 ? "−" : ""}${f(Math.abs(d))}`;
  };
  const hasSpark = computed(() => !!read(props.spark as MaybeReactive<unknown>));
  const tone = (): string => { const d = dir(); if (!d || d === "flat") return "m-stat-neutral"; return (d === "up") !== !!read(props.invert) ? "m-stat-good" : "m-stat-bad"; };
  return h("div", { class: () => ["m-stat", read(props.class)].filter(Boolean).join(" ") },
    // label over value: the StatTile of march/data (one drawing of the tile); the delta pill and the sparkline are the chart's own
    h(StatTile, {
      align: "start", order: "label", partClass: { label: "m-stat-label", value: "m-stat-value" },
      label: [isIconDef(props.icon) ? h("span", { class: "m-stat-icon", "aria-hidden": "true" }, svgIcon(props.icon)) : null, h("span", {}, () => read(props.label) ?? "")],
      value: () => { const v = read(props.value); return v == null ? (read(props.empty) ?? "—") : fmt()(v); },
    }),
    () => (dir() ? h("div", { class: () => `m-stat-delta m-stat-${dir()} ${tone()}` },
      h("span", { class: "m-stat-arrow", "aria-hidden": "true" }, () => ARROWS[dir() as Dir]),
      h("span", { class: "m-sr-only" }, () => SAY[dir() as Dir]),
      h("span", { class: "m-stat-delta-value" }, deltaText),
      () => (read(props.hint) ? h("span", { class: "m-stat-hint" }, ` ${read(props.hint)}`) : null)) : null),
    () => (hasSpark() ? h(Sparkline, { data: reactive(() => read(props.spark as MaybeReactive<Iterable<D> | null | undefined>)), y: props.sparkY, width: 240, height: 40, area: true, title: reactive(() => read(props.label) as string | null | undefined) }) : null));
}
