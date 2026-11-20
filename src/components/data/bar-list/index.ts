// BarList: ranked horizontal bars (top N lists) (march/charts). Folder: src/components/data/bar-list/; shared chart parts (scales, axes, tooltip, data table,
// formats) are in src/charts/.
import "./bar-list.css";
import { computed, read } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, attr, each, type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, f1 } from "../../../charts/util.ts";
import { OverflowText } from "../../../ui/marquee.ts";
import type { Handler } from "../../../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

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
  onSelect?: Handler<[item: BarListItem<D> & { rank: number }]> | undefined;
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
