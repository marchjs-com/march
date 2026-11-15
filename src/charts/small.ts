// Small charts: Sparkline, Stat (KPI box), ProgressRing (0–100 score) and BarList (ranked horizontal bars).
import { computed, read, reactive, effect } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { lttb } from "./lttb.ts";
import { svgIcon, isIconDef } from "../icons/svg.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, attr, each, type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, f1 } from "./util.ts";
import { OverflowText } from "../ui/marquee.ts";
import { StatTile } from "../components/data/stat-tile/index.ts";
import { colorAttr, colorList, paintOf, type ColorToken, type MultiColors } from "../theme/colors.ts";
import { cx } from "../ui/util.ts";
import { clamp } from "../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

export interface SparklineProps<D = unknown> {
  /** Numbers, or objects read through `y`; an array, signal or function. @tr Sayılar ya da `y` ile okunan nesneler; dizi, sinyal veya fonksiyon. */
  data?: DataProp<D>;
  /** The value of an object row: a key or getter. @tr Nesne satırının değeri: bir anahtar ya da getter. */
  y?: Field<D> | undefined;
  /** Width in px (default 120). @tr px cinsinden genişlik (varsayılan 120). */
  width?: Opt<number | string>;
  /** Height in px (default 32). @tr px cinsinden yükseklik (varsayılan 32). */
  height?: Opt<number | string>;
  /** Value format used in the accessible summary. @tr Erişilebilir özette kullanılan değer biçimi. */
  format?: Opt<FormatSpec>;
  /** Include 0 in the value range. @tr Değer aralığına 0'ı katar. */
  zero?: Opt<boolean>;
  /** Fill the area under the line. @tr Çizginin altını doldurur. */
  area?: Opt<boolean>;
  /** Marker on the last point (default true; `false` hides it). @tr Son noktadaki işaret (varsayılan true; `false` gizler). */
  dot?: Opt<boolean>;
  /** Palette slot of the series color (0-based, default 0). @tr Seri renginin palet sırası (0'dan başlar, varsayılan 0). */
  color?: Opt<number>;
  /** Colors overriding the palette (the first one is used). @tr Paleti geçersiz kılan renkler (ilki kullanılır). */
  colors?: ChartBaseProps["colors"];
  /** Accessible name, read before the summary. @tr Özetten önce okunan erişilebilir ad. */
  title?: Opt<string>;
  /** Accessible text when there is no data (default "No data"). @tr Veri yokken erişilebilir metin (varsayılan "No data"). */
  empty?: Opt<string>;
}
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
export interface ProgressRingProps {
  /**
   * Several colors: "brand" (the four HADİ colors, the HADİ theme's default), a list of color tokens, or "single" (one
   * color even in a multicolor theme).
   * @tr Birden çok renk: "brand" (dört HADİ rengi, HADİ temasının varsayılanı), bir renk belirteci listesi ya da "single"
   * (çok renkli bir temada bile tek renk).
   */
  colors?: MultiColors | undefined;
  /** How several colors are laid out: "gradient" (default), "segments" (equal parts) or "cycle" (colors flow). @tr Birden çok renk nasıl dizilir: "gradient" (varsayılan), "segments" (eşit parçalar) ya da "cycle" (renkler akar). */
  paint?: "gradient" | "segments" | "cycle" | undefined;
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. @tr Tema renk belirteci (bkz. ColorToken): "brand-blue", "success", "cat-3"… Varsayılan: temanın primary rengi. */
  color?: ColorToken | undefined;
  /** The score, clamped to 0…max. @tr Puan; 0…max aralığına sıkıştırılır. */
  value?: Opt<number>;
  /** The full score (default 100). @tr Tam puan (varsayılan 100). */
  max?: Opt<number>;
  /** Diameter in px (default 64). @tr px cinsinden çap (varsayılan 64). */
  size?: Opt<number>;
  /** Ring thickness in px (default 8). @tr px cinsinden halka kalınlığı (varsayılan 8). */
  thickness?: Opt<number>;
  /** Percent limits of the low / mid / high levels (default [50, 80]). @tr Düşük / orta / yüksek düzeylerin yüzde sınırları (varsayılan [50, 80]). */
  thresholds?: Opt<readonly [number, number]>;
  /** Format of the number in the middle (default rounded). @tr Ortadaki sayının biçimi (varsayılan yuvarlanmış). */
  format?: Opt<FormatSpec>;
  /** Accessible name (default "Score"). @tr Erişilebilir ad (varsayılan "Score"). */
  label?: Opt<string>;
}
/** BarList row as passed to `onSelect`. */
export interface BarListItem<D = unknown> { key: string; label: string; value: number; datum: D; index: number }
export interface BarListProps<D = unknown> {
  /** Rows: an array (or signal / function returning one). @tr Satırlar: bir dizi (ya da onu döndüren sinyal / fonksiyon). */
  data?: DataProp<D>;
  /** Row label: a key or getter (default "label"). @tr Satır etiketi: bir anahtar ya da getter (varsayılan "label"). */
  x?: Field<D> | undefined;
  /** Row value: a key or getter (default "value"; with a list, the first). @tr Satır değeri: bir anahtar ya da getter (varsayılan "value"; liste verilirse ilki). */
  y?: Field<D> | readonly Field<D>[] | undefined;
  /** Value format: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Sort by value, largest first (default true). @tr Değere göre, büyükten küçüğe sıralar (varsayılan true). */
  sort?: Opt<boolean>;
  /** Show only the first N rows. @tr Yalnız ilk N satırı gösterir. */
  limit?: Opt<number>;
  /** Value of a full bar (default the largest value). @tr Dolu bir çubuğun değeri (varsayılan en büyük değer). */
  max?: Opt<number>;
  /** Palette slot of the series color (0-based, default 0). @tr Seri renginin palet sırası (0'dan başlar, varsayılan 0). */
  color?: Opt<number>;
  /** Colors overriding the palette (the first one is used). @tr Paleti geçersiz kılan renkler (ilki kullanılır). */
  colors?: ChartBaseProps["colors"];
  /** aria-label of the list. @tr Listenin aria-label'ı. */
  title?: Opt<string>;
  /** Shown when there is no data (default "No data"). @tr Veri yokken gösterilir (varsayılan "No data"). */
  empty?: Opt<unknown>;
  /** Extra CSS classes on the root. @tr Köke eklenen ek CSS sınıfları. */
  class?: Opt<string>;
  /** Makes rows buttons; called with the clicked row and its rank. @tr Satırları düğme yapar; tıklanan satır ve sırasıyla çağrılır. */
  onSelect?: ((item: BarListItem<D> & { rank: number }) => void) | undefined;
}


/** Tiny trend line without axes. `data` = numbers or objects (`y` key/fn). */
export function Sparkline<D>(props: SparklineProps<D>): Element {
  const w = computed(() => num(read(props.width)) ?? 120), ht = computed(() => num(read(props.height)) ?? 32);
  const vals = computed(() => { const g = accessor(props.y); return rowsOf(props.data).map((d, i) => num(g(d, i))); });
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const geo = computed((): { line: string; area: string; last: [number, number] | null } => {
    const v = vals(), W = w(), H = ht(), pad = 3;
    const at = (i: number): number => v[i] as number;
    let idx = v.map((_, i) => i).filter((i) => v[i] != null);
    if (idx.length > W * 2) idx = lttb(idx, Math.round(W * 2), (i) => i, at);
    if (!idx.length) return { line: "", area: "", last: null };
    let lo = Infinity, hi = -Infinity;
    for (const i of idx) { lo = Math.min(lo, at(i)); hi = Math.max(hi, at(i)); }
    if (read(props.zero)) lo = Math.min(lo, 0);
    const n = v.length - 1 || 1, sx = (i: number): number => f1(pad + (i / n) * (W - pad * 2));
    const sy = (x: number): number => f1(hi === lo ? H / 2 : H - pad - ((x - lo) / (hi - lo)) * (H - pad * 2));
    const pts = idx.map((i) => `${sx(i)},${sy(at(i))}`);
    const last = idx[idx.length - 1] as number;
    return { line: `M${pts.join("L")}`, area: `M${sx(idx[0] as number)},${H}L${pts.join("L")}L${sx(last)},${H}Z`, last: [sx(last), sy(at(last))] };
  });
  const summary = (): unknown => {
    const v = vals().filter((x): x is number => x != null), f = fmt();
    if (!v.length) return read(props.empty) ?? "No data";
    return `${v.length} values, from ${f(v[0])} to ${f(v[v.length - 1])}, min ${f(Math.min(...v))}, max ${f(Math.max(...v))}`;
  };
  return h("svg", {
    class: () => `m-sparkline ${seriesClass(num(read(props.color)) ?? 0)}`, style: () => colorStyle(props.colors, 0),
    role: "img", "aria-label": () => (read(props.title) ? `${read(props.title)}: ${summary()}` : summary()),
    viewBox: () => `0 0 ${w()} ${ht()}`, width: w, height: ht, preserveAspectRatio: "none",
  },
  () => (read(props.area) ? h("path", { class: "m-chart-area", d: attr(() => geo().area) }) : null),
  h("path", { class: "m-chart-line", d: attr(() => geo().line) }),
  h("circle", { class: "m-chart-marker", r: 2.5, visibility: () => (geo().last && read(props.dot) !== false ? "visible" : "hidden"),
    cx: attr(() => geo().last?.[0] ?? 0), cy: attr(() => geo().last?.[1] ?? 0) }));
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

/** Score ring 0–100 (or 0–`max`). Level class `m-ring-low|mid|high` from `thresholds` (default [50, 80]). */
export function ProgressRing(props: ProgressRingProps): Element {
  const S = computed(() => num(read(props.size)) ?? 64), T = computed(() => num(read(props.thickness)) ?? 8);
  const max = computed(() => num(read(props.max)) ?? 100);
  const v = computed(() => clamp(num(read(props.value)) ?? 0, 0, max()));
  const r = computed(() => (S() - T()) / 2), C = computed(() => 2 * Math.PI * r());
  const level = computed(() => { const [a, b] = read(props.thresholds) ?? [50, 80], p = (v() / max()) * 100; return p < a ? "low" : p < b ? "mid" : "high"; });
  const text = (): unknown => formatter(read<FormatSpec | null | undefined>(props.format), (x) => String(Math.round(x as number)))(v());
  const list = colorList(props.colors);
  const svg = h("svg", { "data-m-color": () => colorAttr(props.color),
    class: () => `m-ring m-ring-${level()}`, role: "img", viewBox: () => `0 0 ${S()} ${S()}`, width: S, height: S,
    "aria-label": () => `${read(props.label) ?? "Score"}: ${text()} of ${max()}`,
  },
  h("circle", { class: "m-ring-track", cx: () => S() / 2, cy: () => S() / 2, r, "stroke-width": T }),
  h("circle", { class: "m-ring-value", cx: () => S() / 2, cy: () => S() / 2, r, "stroke-width": T, transform: () => `rotate(-90 ${S() / 2} ${S() / 2})`,
    "stroke-dasharray": attr(() => `${f1((C() * v()) / max())} ${f1(C())}`) }),
  h("text", { class: "m-ring-text", x: () => S() / 2, y: () => S() / 2, "text-anchor": "middle", "dominant-baseline": "central", "aria-hidden": "true" }, text));
  if (!list && props.paint !== "cycle") return svg as Element;
  // several colors: SVG strokes cannot take a sweep gradient, so a conic paint is masked to the ring (CSS) and laid over
  const paint = h("span", { class: cx("m-ring-paint", props.paint === "cycle" && "is-cycle"), "aria-hidden": "true" }) as HTMLElement;
  const wrap = h("span", { class: "m-ring-multi", "data-m-color": () => colorAttr(props.color), "data-m-colors": list ? (Array.isArray(props.colors) ? "custom" : String(props.colors)) : null }, svg, paint) as HTMLElement;
  paint.style.setProperty("--m-ring-paint", paintOf(list ?? ["cat-1", "cat-2", "cat-3", "cat-4"], props.paint === "segments" ? "segments" : "gradient", "conic", true));
  effect(() => { wrap.style.setProperty("--m-ring-s", `${S()}px`); wrap.style.setProperty("--m-ring-t", `${T()}px`); wrap.style.setProperty("--m-ring-p", String(props.paint === "cycle" ? 1 : v() / max())); });
  return wrap
}

/** Ranked horizontal bars with labels ("top N" lists). Rows are buttons when `onSelect` is set. */
export function BarList<D>(props: BarListProps<D>): Element {
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const items = computed(() => {
    const l = accessor(props.x ?? "label"), y = accessor(Array.isArray(props.y) ? (props.y as readonly Field<D>[])[0] : (props.y as Field<D> | undefined) ?? "value");
    let list: BarListItem<D>[] = rowsOf(props.data).map((d, i) => ({ key: String(l(d, i)), label: String(l(d, i)), value: num(y(d, i)) ?? 0, datum: d, index: i }));
    if (read(props.sort) !== false) list = list.slice().sort((a, b) => b.value - a.value);
    const n = num(read(props.limit));
    return n ? list.slice(0, n) : list;
  });
  const max = computed(() => num(read(props.max)) ?? Math.max(0, ...items().map((i) => i.value)));
  return h("div", { class: () => ["m-barlist", read(props.class)].filter(Boolean).join(" "), role: "list", "aria-label": () => read(props.title) ?? null },
    each<BarListItem<D>>({ each: items, key: (i) => i.key, fallback: () => h("div", { class: "m-chart-empty" }, read(props.empty) ?? "No data"), children: (it, idx) => {
      const pct = attr(() => `${max() > 0 ? f1((Math.max(0, it().value) / max()) * 100) : 0}%`);
      const sel = props.onSelect;
      return h("div", { role: "listitem", class: "m-barlist-item" },
        h(sel ? "button" : "div", { class: "m-barlist-row", ...(sel ? { type: "button", onClick: () => sel({ ...it(), rank: idx() + 1 }) } : {}) },
          h("svg", { class: "m-barlist-bar", "aria-hidden": "true", width: "100%", height: "100%", preserveAspectRatio: "none" },
            h("rect", { class: () => `m-barlist-fill ${seriesClass(num(read(props.color)) ?? 0)}`, style: () => colorStyle(props.colors, 0), x: 0, y: 0, height: "100%", width: pct })),
          h(OverflowText, { class: "m-barlist-label" }, () => it().label),
          h("span", { class: "m-barlist-value" }, () => fmt()(it().value))));
    } }));
}
