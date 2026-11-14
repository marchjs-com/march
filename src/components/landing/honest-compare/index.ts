// HonestCompare (hadi-march/landing): a comparison table that also shows where the product is behind. Each cell is
// yes / partly / no or a short text; a row where another column scores higher than `us` is marked "behind" and keeps
// its note visible (why, and what is planned). A summary counts ahead / even / behind rows, and a toggle shows only
// the rows where the product loses. A real table (caption, column and row headers); marks carry text for screen
// readers. Wide tables scroll sideways with the first column fixed.
import "./honest-compare.css";
import { h } from "../../../dom/h.ts";
import { signal, computed } from "../../../core/reactive.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, val, glyph, type ClassProp } from "../../../ui/util.ts";
import { check as checkIcon } from "../../../icons/glyphs/check.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { minus as minusIcon } from "../../../icons/glyphs/minus.ts";
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
  /** Columns; the one with id `us` is highlighted and scored against the others. */
  columns: CompareColumn[];
  rows: CompareRow[];
  /** Id of the product's own column (default "us"). */
  us?: string | undefined;
  /** Table caption (screen readers; shown when `showCaption`). */
  caption?: unknown | undefined;
  showCaption?: boolean | undefined;
  /** Show the ahead / even / behind summary and the "only where we are behind" toggle (default true). */
  summary?: boolean | undefined;
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

  const cell = (v: CompareValue): unknown => {
    if (v === true) return [glyph(checkIcon, "hm-svg hm-hc-yes"), h("span", { class: "hm-sr-only" }, t`Yes`)];
    if (v === false) return [glyph(xIcon, "hm-svg hm-hc-no"), h("span", { class: "hm-sr-only" }, t`No`)];
    if (v === "partial") return [glyph(minusIcon, "hm-svg hm-hc-part"), h("span", { class: "hm-hc-part-text" }, t`Partly`)];
    return v == null ? h("span", { class: "hm-hc-none" }, "—") : v;
  };
  const tag = (v: 1 | 0 | -1 | null): Element | null =>
    v === -1 ? h("span", { class: "hm-hc-tag is-behind" }, t`Behind`) : v === 1 ? h("span", { class: "hm-hc-tag is-ahead" }, t`Ahead`) : null;

  const body = h("tbody", null, ...props.rows.flatMap((r, i) => {
    const v = verdicts[i]!;
    const hidden = (): boolean => onlyBehind() && v !== -1;
    const line = h("tr", { class: () => cx("hm-hc-row", v === -1 && "is-behind", v === 1 && "is-ahead", hidden() && "is-hidden"), hidden: hidden },
      h("th", { scope: "row", class: "hm-hc-label" }, h("span", null, r.label), tag(v)),
      ...props.columns.map((c) => h("td", { class: cx("hm-hc-cell", c.id === us && "hm-hc-us") }, cell(r.values[c.id]))));
    const note = r.note != null
      ? h("tr", { class: () => cx("hm-hc-note-row", v === -1 && "is-behind"), hidden: hidden },
        h("td", { colspan: String(props.columns.length + 1), class: "hm-hc-note" }, r.note))
      : null;
    return note ? [line, note] : [line];
  }));

  const table = h("table", { class: "hm-hc-table" },
    h("caption", { class: props.showCaption ? "hm-hc-caption" : "hm-sr-only" }, props.caption ?? t`Comparison`),
    h("thead", null, h("tr", null,
      h("td", { class: "hm-hc-corner" }),
      ...props.columns.map((c) => h("th", { scope: "col", class: cx("hm-hc-head", c.id === us && "hm-hc-us") }, c.name)))),
    body);

  const summary = props.summary === false ? null : h("div", { class: "hm-hc-summary" },
    h("p", { class: "hm-hc-counts" },
      () => t`Ahead in ${counts().ahead}, even in ${counts().even}, behind in ${counts().behind}.`),
    counts().behind ? h("button", {
      type: "button", class: "hm-hc-filter", "aria-pressed": () => String(onlyBehind()), onClick: () => onlyBehind.set(!onlyBehind.peek()),
    }, () => (onlyBehind() ? t`Show all rows` : t`Only where we are behind`)) : null);

  return h("div", { class: () => cx("hm-hc", val(props.class)) }, summary, h("div", { class: "hm-hc-scroll", tabindex: "0", role: "region", "aria-label": () => t`Comparison table` }, table));
}
