// crud(): a complete list/create/edit/delete screen from a data source and a schema.
//   {crud({ list, create, update, remove }, { schema: Product, title: "Products" })}
// list(params) → { items, total? , nextCursor? } (server mode, params from the table: page, size, sort, filters, search…)
//   or an array (client mode: sorting/filtering/paging in the browser). Built from Table, Form, Dialog and action().
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { query } from "../data/index.js";
import { createTable, Table } from "../table/index.js";
import { Form } from "../forms/index.js";
import { openDialog, askReason } from "../ui/dialog.js";
import { Button } from "../ui/button.js";
import { action } from "../ui/action.js";

/**
 * @param {{ list: (params: any) => Promise<any>, get?: (id: any) => Promise<any>, create?: (values: any) => Promise<any>,
 *           update?: (id: any, values: any, ctx: { changed: any, reason?: string }) => Promise<any>, remove?: (id: any, reason?: string) => Promise<any> }} source
 * @param {{ schema: any, formSchema?: any, title?: string, rowKey?: string, columns?: any[], mode?: "server"|"client",
 *           rowActions?: any[], bulkActions?: any[], urlKey?: string, storageKey?: string, paging?: any, pageSize?: number,
 *           can?: { create?: any, update?: any, remove?: any }, reason?: { save?: number, remove?: number },
 *           labels?: { create?: string, edit?: string, remove?: string }, expand?: (row: any) => any, empty?: any,
 *           dialogSize?: "sm"|"md"|"lg"|"full" }} opts
 */
export function crud(source, opts) {
  const key = opts.rowKey ?? "id";
  const formSchema = opts.formSchema ?? opts.schema.omit(...opts.schema.fields.filter((f) => f.readonly).map((f) => f.name));
  const L = { create: t`New`, edit: t`Edit`, remove: t`Delete`, ...(opts.labels ?? {}) };
  const client = opts.mode === "client";
  const rows = client ? query(({ signal }) => source.list({ signal }), { key: ["crud", opts.title ?? "items"] }) : null;
  const table = createTable({
    ...(client ? { rows: () => rows() ?? [], loading: () => rows.loading(), error: () => rows.error() } : { source: (p) => source.list(p) }),
    schema: opts.columns ? undefined : opts.schema, columns: opts.columns, rowKey: key,
    urlKey: opts.urlKey, storageKey: opts.storageKey, paging: opts.paging, pageSize: opts.pageSize,
  });
  const refresh = () => (client ? rows.refetch() : table.refetch());

  const editor = (title, initial, submit) => openDialog((close) => h(Form, {
    schema: formSchema, initial, cancel: () => close(null),
    onSubmit: async (values, form) => { const r = await submit(values, form); close(r ?? true); },
  }), { title, size: opts.dialogSize ?? "md" });

  const create = source.create && action(L.create, async () => {
    const r = await editor(L.create, formSchema.defaults(), (v) => source.create(v));
    if (r !== null) await refresh();
    return r;
  }, { can: opts.can?.create, success: false });

  const edit = source.update && action(L.edit, async (row) => {
    const initial = source.get ? await source.get(row[key]) : row;
    const r = await editor(L.edit, initial, async (values) => {
      const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(initial?.[k])));
      let reason;
      if (opts.reason?.save) {
        reason = await askReason({ title: L.edit, min: opts.reason.save });
        if (reason == null) throw Object.assign(new Error(t`Cancelled`), { code: "cancelled" });
      }
      return source.update(row[key], values, { changed, reason });
    });
    if (r !== null) await refresh();
    return r;
  }, { can: opts.can?.update, success: false });

  const remove = source.remove && action(L.remove, async (row, reason) => { await source.remove(row[key], reason); await refresh(); }, {
    danger: true, can: opts.can?.remove, success: t`Deleted`,
    ...(opts.reason?.remove ? { reason: opts.reason.remove } : { confirm: (row) => t`Delete "${row.name ?? row.title ?? row[key]}"?` }),
  });

  return h(Table, {
    table,
    rowActions: [edit, ...(opts.rowActions ?? []), remove].filter(Boolean),
    bulkActions: opts.bulkActions,
    expand: opts.expand,
    empty: opts.empty,
    onRowClick: edit ? (row) => edit.run(row).catch(() => {}) : undefined,
    toolbarEnd: create ? h(Button, { variant: "primary", onClick: () => create.run().catch(() => {}), hidden: () => !create.visible() }, L.create) : null,
  });
}
