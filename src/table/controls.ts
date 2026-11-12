// Table controls shared by <Table> and DataGrid: the filter control per filter type and the inline cell editor.
// Their own module so a component can use them without pulling the <Table> renderer (render.ts).
import "../css/table.css";
import { effect, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import type { TableState } from "./state.ts";
import type { TableColumn } from "./filters.ts";

type Rec = Record<string, unknown>;
const list = (v: unknown): unknown[] => ([] as unknown[]).concat(v);

/** One control per filter type. */
export function FilterControl<R>(table: TableState<R>, col: TableColumn<R>): Element {
  const key = col.key as string;
  const cur = (): unknown => table.filters()[key];
  const set = (v: unknown): void => table.setFilter(key, v);
  const field = (label: string, input: Element): Element => h("label", { class: "hm-table-filter-field" }, h("span", {}, label), input);
  const pair = (a: string, b: string, type: string): Element[] => {
    const part = (k: string, label: string): Element => field(label, h("input", {
      type, class: "hm-table-input", value: () => (cur() as Rec | null | undefined)?.[k] ?? "",
      onInput: (e: Event) => { const v = (e.target as HTMLInputElement).value; set({ ...((untrack(cur) as Rec | null | undefined) ?? {}), [k]: v === "" ? null : type === "number" ? Number(v) : v }); },
    }));
    return [part(a, a === "min" ? t`Min` : t`From`), part(b, b === "max" ? t`Max` : t`To`)];
  };
  let body: unknown;
  switch (col.filter) {
    case "range": body = pair("min", "max", "number"); break;
    case "dateRange": body = pair("from", "to", "date"); break;
    case "bool": {
      const sel = h("select", { class: "hm-table-input", onChange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; set(v === "" ? null : v === "true"); } },
        h("option", { value: "" }, t`All`), h("option", { value: "true" }, t`Yes`), h("option", { value: "false" }, t`No`)) as HTMLSelectElement;
      effect(() => { const v = cur(); sel.value = v == null ? "" : String(v); });
      body = sel;
      break;
    }
    case "select": {
      body = () => {
        const opts = table.filterOptions(key);
        return untrack(() => (col.filterMultiple === false
          ? (() => {
            const sel = h("select", { class: "hm-table-input", "aria-label": col.label, onChange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; set(v === "" ? null : [opts[Number(v)]?.value]); } },
              h("option", { value: "" }, t`All`), opts.map((o, i) => h("option", { value: String(i) }, o.label))) as HTMLSelectElement;
            effect(() => { const v = list(cur() ?? [])[0]; const i = opts.findIndex((o) => o.value === v); sel.value = i < 0 ? "" : String(i); });
            return sel;
          })()
          : h("div", { class: "hm-table-options", role: "group", "aria-label": col.label }, opts.map((o) => h("label", { class: "hm-table-option" },
            h("input", {
              type: "checkbox", checked: () => list(cur() ?? []).includes(o.value),
              onChange: (e: Event) => { const l = list(untrack(cur) ?? []).filter((x) => x !== o.value); set((e.target as HTMLInputElement).checked ? [...l, o.value] : l); },
            }), o.label)))));
      };
      break;
    }
    default:
      body = h("input", { type: "search", class: "hm-table-input", "aria-label": col.label, value: () => cur() ?? "", onInput: (e: Event) => set((e.target as HTMLInputElement).value) });
  }
  return h("fieldset", { class: ["hm-table-filter", `hm-table-filter--${col.filter}`], "data-filter": col.key },
    h("legend", {}, col.label), body);
}

const INPUT_TYPES: Record<string, string> = { number: "number", int: "number", money: "number", percent: "number", date: "date", email: "email", url: "url", bool: "checkbox", color: "color", time: "time" };
function inputTypeOf<R>(col: TableColumn<R>): string {
  return INPUT_TYPES[String(col.type)] ?? "text";
}

/**
 * Inline cell editor for a table's current edit (`table.editing()`): input / select / checkbox by column type, Enter
 * saves, Escape cancels, validation message under it. Shared by <Table> and DataGrid. `onKey` runs first; call
 * `e.preventDefault()` there to replace the default handling of a key (DataGrid: Tab saves and moves on).
 */
export function CellEditor<R>(table: TableState<R>, col: TableColumn<R>, row: R, idBase: string, onKey?: (e: KeyboardEvent) => void): Element {
  const key = col.key as string;
  const errId = `${idBase}-err-${String(table.idOf(row)).replace(/[^\w-]/g, "_")}-${col.key}`;
  const draft = untrack(table.editing)?.draft;
  const type = inputTypeOf(col);
  const keys = (e: KeyboardEvent): void => {
    e.stopPropagation();
    onKey?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter") { e.preventDefault(); void table.commitEdit(); }
    else if (e.key === "Escape") { e.preventDefault(); table.cancelEdit(); }
  };
  const common = {
    class: "hm-table-input hm-table-editor", "aria-label": t`Edit ${col.label}`,
    "aria-invalid": () => (table.editing()?.error ? "true" : null), "aria-describedby": errId,
    disabled: () => !!table.editing()?.saving, onKeyDown: keys,
    ref: (el: HTMLElement) => setTimeout(() => el.isConnected && el.focus?.(), 0),
  };
  let input: Element;
  if (col.options) {
    const opts = table.filterOptions(key);
    const sel = h("select", { ...common, onChange: (e: Event) => table.setDraft(opts[Number((e.target as HTMLSelectElement).value)]?.value) }, opts.map((o, i) => h("option", { value: String(i) }, o.label))) as HTMLSelectElement;
    sel.value = String(Math.max(0, opts.findIndex((o) => o.value === draft)));
    input = sel;
  } else if (type === "checkbox") {
    input = h("input", { ...common, type, checked: !!draft, onChange: (e: Event) => table.setDraft((e.target as HTMLInputElement).checked) });
  } else {
    input = h("input", { ...common, type, value: draft ?? "", onInput: (e: Event) => table.setDraft((e.target as HTMLInputElement).value) });
  }
  return h("span", { class: "hm-table-edit", "data-no-row-click": "" }, input,
    h("span", { id: errId, class: "hm-table-edit-error", role: "alert" }, () => table.editing()?.error ?? ""));
}

