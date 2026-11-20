// Sparkline: a tiny trend line without axes (march/charts). Folder: src/components/data/sparkline/; shared chart parts (scales, axes, tooltip, data table,
// formats) are in src/charts/.
import "./sparkline.css";
import { computed, read } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { lttb } from "../../../charts/lttb.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, attr, type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, f1 } from "../../../charts/util.ts";

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
