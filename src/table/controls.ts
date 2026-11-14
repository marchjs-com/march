// Table controls shared by <Table> and DataGrid: the filter control per filter type, the inline cell editor and the
// sort mark of a column header. Their own module so a component can use them without pulling the <Table> renderer
// (render.ts). Every control is a shared form component; the date picker loads the first time a date control shows.
import "../css/table.css";
import { untrack } from "../core/reactive.ts";
import { h, lazyChildren } from "../dom/h.ts";
import { lazy, skeleton } from "../dom/lazy.ts";
import { t } from "../core/i18n.ts";
import { uid } from "../core/util.ts";
import { svgIcon } from "../icons/svg.ts";
import { arrowUp } from "../icons/glyphs/arrowUp.ts";
import { Field } from "../forms/field.ts";
import { parseNumber, live } from "../forms/util.ts";
import { TextInput } from "../components/forms/text-input/index.ts";
import { NumberInput } from "../components/forms/number-input/index.ts";
import { Select } from "../components/forms/select/index.ts";
import { Checkbox } from "../components/forms/checkbox/index.ts";
import { CheckboxGroup } from "../components/forms/checkbox-group/index.ts";
import type { DatePickerProps } from "../components/forms/date-picker/index.ts";
import type { TableState } from "./state.ts";
import type { TableColumn } from "./filters.ts";

type Rec = Record<string, unknown>;
const list = (v: unknown): unknown[] => ([] as unknown[]).concat(v);
// the calendar is the one large control here: the same chunk the form engine loads for date fields
const DatePicker = lazy<DatePickerProps>(() => import("../forms/date.ts"), { pick: "DatePicker", placeholder: () => skeleton("text") });

/** One control per filter type. */
export function FilterControl<R>(table: TableState<R>, col: TableColumn<R>): Element {
  const key = col.key as string;
  const cur = (): unknown => table.filters()[key];
  const set = (v: unknown): void => table.setFilter(key, v);
  const legendId = uid("m-table-filter");
  const pair = (a: string, b: string, date: boolean): unknown[] => {
    const part = (k: string, label: string): unknown => h(Field, { label, compact: true, class: "m-table-filter-field" }, lazyChildren(() => h(date ? DatePicker : NumberInput, {
      value: live(() => ((cur() as Rec | null | undefined)?.[k] as never) ?? null),
      onChange: (v: unknown) => set({ ...((untrack(cur) as Rec | null | undefined) ?? {}), [k]: v ?? null }),
    })));
    return [part(a, a === "min" ? t`Min` : t`From`), part(b, b === "max" ? t`Max` : t`To`)];
  };
  let body: unknown;
  switch (col.filter) {
    case "range": body = pair("min", "max", false); break;
    case "dateRange": body = pair("from", "to", true); break;
    case "bool":
      body = h(Select, {
        "aria-label": col.label, placeholder: t`All`, options: [{ value: true, label: t`Yes` }, { value: false, label: t`No` }],
        value: live(() => (cur() as boolean | null | undefined) ?? null), onChange: set,
      });
      break;
    case "select": {
      body = () => {
        const opts = table.filterOptions(key);
        return untrack(() => (col.filterMultiple === false
          ? h(Select, { "aria-label": col.label, placeholder: t`All`, options: opts, value: live(() => list(cur() ?? [])[0] ?? null), onChange: (v: unknown) => set(v == null ? null : [v]) })
          : h(CheckboxGroup, { class: "m-table-options", labelledby: legendId, options: opts, value: live(() => list(cur() ?? [])), onChange: set })));
      };
      break;
    }
    default:
      body = h(TextInput, { type: "search", "aria-label": col.label, value: live(() => String(cur() ?? "")), onChange: set });
  }
  return h("fieldset", { class: ["m-table-filter", `m-table-filter--${col.filter}`], "data-filter": col.key },
    h("legend", { id: legendId }, col.label), body);
}

/** The sort arrow of a column header, with the column's place in a sort by several columns. One part for <Table> and DataGrid. */
export function SortMark<R>(table: TableState<R>, key: string): Element {
  const dir = (): string | null => table.sortDir(key);
  return h("span", { class: () => ["m-sort-mark", dir() === "desc" && "is-desc", !dir() && "is-none"], "aria-hidden": "true" },
    svgIcon(arrowUp),
    () => (dir() && table.sort().length > 1 ? untrack(() => h("small", { class: "m-sort-mark-n" }, () => String(table.sortIndex(key) + 1))) : null));
}
/** `aria-sort` of a column header. */
export const ariaSort = <R>(table: TableState<R>, key: string): "ascending" | "descending" | "none" => { const d = table.sortDir(key); return d === "asc" ? "ascending" : d === "desc" ? "descending" : "none"; };

const NUMERIC = new Set(["number", "int", "money", "percent"]);
const TEXT_TYPES: Record<string, string> = { email: "email", url: "url", color: "color", time: "time" };

/**
 * Inline cell editor for a table's current edit (`table.editing()`): the form control of the column type (text, number,
 * date, select, checkbox), Enter saves, Escape cancels, the validation message under it. Shared by <Table> and
 * DataGrid. `onKey` runs first; call `e.preventDefault()` there to replace the default handling of a key (DataGrid:
 * Tab saves and moves on).
 */
export function CellEditor<R>(table: TableState<R>, col: TableColumn<R>, row: R, idBase: string, onKey?: (e: KeyboardEvent) => void): Element {
  const key = col.key as string;
  const id = `${idBase}-edit-${String(table.idOf(row)).replace(/[^\w-]/g, "_")}-${col.key}`;
  const draft = untrack(table.editing)?.draft;
  const type = String(col.type);
  const keys = (e: KeyboardEvent): void => {
    e.stopPropagation();
    onKey?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter") { e.preventDefault(); void table.commitEdit(); }
    else if (e.key === "Escape") { e.preventDefault(); table.cancelEdit(); }
  };
  const common = { class: "m-table-editor", "aria-label": t`Edit ${col.label}`, disabled: live(() => !!table.editing()?.saving), onChange: (v: unknown) => table.setDraft(v) };
  const control = (): unknown => {
    if (col.options) return h(Select, { ...common, options: table.filterOptions(key), value: draft });
    if (type === "bool") return h(Checkbox, { ...common, value: !!draft });
    if (NUMERIC.has(type)) {
      const n = typeof draft === "number" ? draft : parseNumber(draft);
      return h(NumberInput, { ...common, value: n == null || Number.isNaN(n) ? null : n, decimals: type === "int" ? 0 : undefined });
    }
    if (type === "date") return h(DatePicker, { ...common, value: (draft as string | null | undefined) || null });
    return h(TextInput, { ...common, type: TEXT_TYPES[type] ?? "text", value: draft == null ? "" : String(draft) });
  };
  // the Field gives the control its id, the invalid state and the link to the message
  return h("div", {
    class: "m-table-edit", "data-no-row-click": "", onKeyDown: keys,
    ref: (el: HTMLElement) => setTimeout(() => el.isConnected && el.querySelector<HTMLElement>("input, select")?.focus(), 0),
  }, h(Field, { id, compact: true, error: live(() => table.editing()?.error ?? null) }, lazyChildren(control)));
}
