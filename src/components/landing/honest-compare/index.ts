// HonestCompare (hadi-march/landing): a comparison table that also shows where the product is behind. Each cell is
// yes / partly / no or a short text; a row where another column scores higher than `us` is marked "behind" and keeps
// its note visible (why, and what is planned). A summary counts ahead / even / behind rows, and a toggle shows only
// the rows where the product loses. A real table (caption, column and row headers); marks carry text for screen
// readers. Wide tables scroll sideways with the first column fixed.
import "./honest-compare.css";
import { h } from "../../../dom/h.ts";
import { signal, computed } from "../../../core/reactive.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";
import { type ColorToken, withColor } from "../../../theme/colors.ts";
import { CheckMark } from "../../feedback/check-mark/index.ts";
import { Badge } from "../../data/badge/index.ts";
import { Button } from "../../actions/button/index.ts";
import tr from "./tr.ts";

messages("tr", tr);

/** A cell: true (yes), false (no), "partial", or any text / node (not scored). */
export type CompareValue = boolean | "partial" | string | number | Node | null | undefined;
export interface CompareColumn { id: string; name: unknown }
export interface CompareRow {
  label: unknown;
  /** One value per column id. */
  values: Record<string, CompareValue>;
  /** Why: shown under the row (always when the product is behind). */
  note?: unknown | undefined;
}
export interface HonestCompareProps {
  /** Columns; the one with id `us` is highlighted and scored against the others. @tr Sütunlar; kimliği `us` olan vurgulanır ve diğerlerine karşı puanlanır. */
  columns: CompareColumn[];
  /** The rows: `{ label, values, note? }`; `values` has one entry per column id. @tr Satırlar: `{ label, values, note? }`; `values` her sütun kimliği için bir değer içerir. */
  rows: CompareRow[];
  /** Id of the product's own column (default "us"). @tr Ürünün kendi sütununun kimliği (varsayılan "us"). */
  us?: string | undefined;
  /** Table caption (screen readers; shown when `showCaption`). @tr Tablo başlığı (ekran okuyucular için; `showCaption` ile görünür). */
  caption?: unknown | undefined;
  /** Show the caption on screen (default false: screen readers only). @tr Tablo başlığını ekranda gösterir (varsayılan false: yalnız ekran okuyucular). */
  showCaption?: boolean | undefined;
  /** Show the ahead / even / behind summary and the "only where we are behind" toggle (default true). @tr Önde / eşit / geride özetini ve "only where we are behind" düğmesini gösterir (varsayılan true). */
  summary?: boolean | undefined;
  /** The "only where we are behind" toggle in the summary (default true). @tr Özetteki "only where we are behind" düğmesi (varsayılan true). */
  filter?: boolean | undefined;
  /** The "Ahead" / "Behind" tags beside the row labels (default true). @tr Satır etiketlerinin yanındaki "Ahead" / "Behind" etiketleri (varsayılan true). */
  tags?: boolean | undefined;
  /** Every text the table writes itself; the defaults are translated. `counts` gets the three numbers. @tr Tablonun kendi yazdığı her metin; varsayılanlar çevrilmiştir. `counts` üç sayıyı alır. */
  labels?: {
    yes?: unknown; no?: unknown; partly?: unknown; ahead?: unknown; behind?: unknown;
    /** Accessible name of the scrolling region (default "Comparison table"). */
    region?: string;
    counts?: (counts: { ahead: number; even: number; behind: number }) => unknown;
    onlyBehind?: unknown; showAll?: unknown;
  } | undefined;
  /**
   * Draw a cell yourself: return content, or undefined to keep the default mark. `info.us`: the product's own column;
   * `info.verdict`: how the row scores (1 ahead, 0 even, -1 behind, null not scored).
   * @tr Bir hücreyi kendiniz çizin: içerik döndürün ya da varsayılan işareti korumak için undefined. `info.us`: ürünün kendi sütunu; `info.verdict`: satırın puanı (1 önde, 0 eşit, -1 geride, null puanlanmamış).
   */
  renderCell?: ((value: CompareValue, info: { row: CompareRow; column: CompareColumn; us: boolean; verdict: 1 | 0 | -1 | null }) => unknown) | undefined;
  /** Extra CSS class on the root (`.m-hc`). @tr Köke (`.m-hc`) eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
}

const score = (v: CompareValue): number | null => (v === true ? 2 : v === "partial" ? 1 : v === false ? 0 : null);
/** How the `us` column does in a row: 1 ahead, 0 even, -1 behind, null when the row is not scored. */
export function compareRow(row: CompareRow, us: string): 1 | 0 | -1 | null {
  const mine = score(row.values[us]);
  if (mine == null) return null;
  const others = Object.entries(row.values).filter(([k]) => k !== us).map(([, v]) => score(v)).filter((x): x is number => x != null);
  if (!others.length) return null;
  const best = Math.max(...others);
  return mine > best ? 1 : mine < best ? -1 : 0;
}

/** `<HonestCompare columns={[{ id: "us", name: "HADİ" }, { id: "a", name: "Other" }]} rows={[{ label: "Offline", values: { us: false, a: true }, note: "Planned for spring" }]} />` */
export function HonestCompare(props: HonestCompareProps): Element {
  const us = props.us ?? "us";
  const verdicts = props.rows.map((r) => compareRow(r, us));
  const onlyBehind = signal(false);
  const counts = computed(() => ({ ahead: verdicts.filter((v) => v === 1).length, even: verdicts.filter((v) => v === 0).length, behind: verdicts.filter((v) => v === -1).length }));

  const L = props.labels ?? {};
  const own = props.renderCell;
  const cell = (v: CompareValue, row: CompareRow, column: CompareColumn, verdict: 1 | 0 | -1 | null): unknown => {
    const mine = own?.(v, { row, column, us: column.id === us, verdict });
    if (mine !== undefined) return mine;
    // yes / no / partly: the shared CheckMark (the text is read by screen readers; "partly" also shows it)
    if (v === true || v === false || v === "partial") return h(CheckMark, {
      value: v, size: "lg", text: v === "partial", class: v === true ? "m-hc-yes" : v === false ? "m-hc-no" : "m-hc-part",
      label: (v === true ? L.yes ?? t`Yes` : v === false ? L.no ?? t`No` : L.partly ?? t`Partly`) as string,
    });
    return v == null ? h("span", { class: "m-hc-none" }, "—") : v;
  };
  const tag = (v: 1 | 0 | -1 | null): unknown =>
    props.tags === false ? null
      : v === -1 ? h(Badge, { tone: "warn", class: "m-hc-tag is-behind" }, L.behind ?? t`Behind`) : v === 1 ? h(Badge, { tone: "success", class: "m-hc-tag is-ahead" }, L.ahead ?? t`Ahead`) : null;

  const body = h("tbody", null, ...props.rows.flatMap((r, i) => {
    const v = verdicts[i]!;
    const hidden = (): boolean => onlyBehind() && v !== -1;
    const line = h("tr", { class: () => cx("m-hc-row", v === -1 && "is-behind", v === 1 && "is-ahead", hidden() && "is-hidden"), hidden: hidden },
      h("th", { scope: "row", class: "m-hc-label" }, h("span", null, r.label), tag(v)),
      ...props.columns.map((c) => h("td", { class: cx("m-hc-cell", c.id === us && "m-hc-us") }, cell(r.values[c.id], r, c, v))));
    const note = r.note != null
      ? h("tr", { class: () => cx("m-hc-note-row", v === -1 && "is-behind"), hidden: hidden },
        h("td", { colspan: String(props.columns.length + 1), class: "m-hc-note" }, r.note))
      : null;
    return note ? [line, note] : [line];
  }));

  const table = h("table", { class: "m-hc-table" },
    h("caption", { class: props.showCaption ? "m-hc-caption" : "m-sr-only" }, props.caption ?? t`Comparison`),
    h("thead", null, h("tr", null,
      h("td", { class: "m-hc-corner" }),
      ...props.columns.map((c) => h("th", { scope: "col", class: cx("m-hc-head", c.id === us && "m-hc-us") }, c.name)))),
    body);

  const summary = props.summary === false ? null : h("div", { class: "m-hc-summary" },
    h("p", { class: "m-hc-counts" },
      () => (L.counts ? L.counts(counts()) : t`Ahead in ${counts().ahead}, even in ${counts().even}, behind in ${counts().behind}.`)),
    counts().behind && props.filter !== false ? withColor(h(Button, {
      class: "m-hc-filter", size: "sm", shape: "pill", pressed: () => onlyBehind(), onClick: () => onlyBehind.set(!onlyBehind.peek()) }, () => (onlyBehind() ? L.showAll ?? t`Show all rows` : L.onlyBehind ?? t`Only where we are behind`)), "warn") : null);

  return h("div", { class: () => cx("m-hc", val(props.class)) }, summary, h("div", { class: "m-hc-scroll", tabindex: "0", role: "region", "aria-label": () => L.region ?? t`Comparison table` }, table));
}
