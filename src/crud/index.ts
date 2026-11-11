// crud(): a complete list/create/edit/delete screen from a data source and a schema.
//   {crud({ list, create, update, remove }, { schema: Product, title: "Products" })}
// list(params) → { items, total? , nextCursor? } (server mode, params from the table: page, size, sort, filters, search…)
//   or an array (client mode: sorting/filtering/paging in the browser). Built from Table, Form, Dialog and action().
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { query } from "../data/index.ts";
import type { Schema } from "../schema/index.ts";
import type { PermCheck } from "../access/index.ts";
import { createTable, Table, type TableProps, type ColumnInput, type RowAction, type BulkAction } from "../table/index.ts";
import { Form } from "../forms/index.ts";
import { openDialog, askReason } from "../ui/dialog.ts";
import { Button } from "../ui/button.ts";
import { action } from "../ui/action.ts";

type Row = Record<string, unknown>;
/** Server-mode page (`list` may also return a plain array in client mode). */
export interface CrudPage<R> { items: R[]; total?: number | null | undefined; nextCursor?: string | null | undefined }
export interface CrudSource<R extends Row = Row> {
  list: (params: Record<string, unknown>) => Promise<CrudPage<R> | R[]>;
  get?: (id: unknown) => Promise<R>;
  create?: (values: Partial<R>) => Promise<unknown>;
  update?: (id: unknown, values: Partial<R>, ctx: { changed: Partial<R>; reason?: string | undefined }) => Promise<unknown>;
  remove?: (id: unknown, reason?: string) => Promise<unknown>;
}
export interface CrudOptions<R extends Row = Row> {
  schema: Schema<R>;
  formSchema?: Schema<Partial<R>>;
  title?: string;
  rowKey?: string;
  columns?: readonly ColumnInput<R>[];
  mode?: "server" | "client";
  rowActions?: readonly RowAction<R>[];
  bulkActions?: readonly BulkAction<R>[];
  urlKey?: string;
  storageKey?: string;
  paging?: boolean | "cursor";
  pageSize?: number;
  can?: { create?: PermCheck; update?: PermCheck; remove?: PermCheck };
  /** Ask for a reason (minimum length) before saving / deleting. */
  reason?: { save?: number; remove?: number };
  labels?: { create?: string; edit?: string; remove?: string };
  expand?: (row: R) => unknown;
  empty?: unknown;
  dialogSize?: "sm" | "md" | "lg" | "full";
}

/** `can` option of action(): left out when no permission check is given. */
const canOpt = (can: PermCheck | undefined): { can?: PermCheck } => (can === undefined ? {} : { can });

export function crud<R extends Row = Row>(source: CrudSource<R>, opts: CrudOptions<R>): unknown {
  const key = opts.rowKey ?? "id";
  const base = opts.schema as Schema<Row>;
  const formSchema = (opts.formSchema as Schema<Row> | undefined) ?? base.omit(...base.fields.filter((f) => f.readonly).map((f) => f.name));
  const L = { create: t`New`, edit: t`Edit`, remove: t`Delete`, ...(opts.labels ?? {}) };
  const client = opts.mode === "client";
  const rows = client ? query(({ signal }) => source.list({ signal }), { key: ["crud", opts.title ?? "items"] }) : null;
  const table = createTable<R>({
    ...(rows ? { rows: () => (rows() as R[] | undefined) ?? [], loading: () => rows.loading(), error: () => rows.error() } : { source: (p) => source.list(p) }),
    schema: opts.columns ? undefined : opts.schema, columns: opts.columns, rowKey: key,
    urlKey: opts.urlKey, storageKey: opts.storageKey, paging: opts.paging, pageSize: opts.pageSize,
  });
  const refresh = (): unknown => (rows ? rows.refetch() : table.refetch());

  const editor = (title: string, initial: Partial<Row>, submit: (values: Partial<R>, form: unknown) => Promise<unknown>): Promise<unknown> => openDialog((close) => h(Form, {
    schema: formSchema, initial, cancel: () => close(null),
    onSubmit: async (values: Row, form: unknown) => { const r = await submit(values as Partial<R>, form); close(r ?? true); },
  }), { title, size: opts.dialogSize ?? "md" });

  const create = source.create && action(L.create, async () => {
    const r = await editor(L.create, formSchema.defaults(), (v) => (source.create as NonNullable<CrudSource<R>["create"]>)(v));
    if (r !== null) await refresh();
    return r;
  }, { ...canOpt(opts.can?.create), success: false });

  const edit = source.update && action(L.edit, async (row: R) => {
    const initial = source.get ? await source.get(row[key]) : row;
    const r = await editor(L.edit, initial, async (values) => {
      const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((initial as Row | undefined)?.[k]))) as Partial<R>;
      let reason: string | undefined;
      if (opts.reason?.save) {
        const r = await askReason({ title: L.edit, min: opts.reason.save });
        if (r == null) throw Object.assign(new Error(t`Cancelled`), { code: "cancelled" });
        reason = r;
      }
      return (source.update as NonNullable<CrudSource<R>["update"]>)(row[key], values, { changed, reason });
    });
    if (r !== null) await refresh();
    return r;
  }, { ...canOpt(opts.can?.update), success: false });

  const remove = source.remove && action(L.remove, async (row: R, reason?: string) => { await (source.remove as NonNullable<CrudSource<R>["remove"]>)(row[key], reason); await refresh(); }, {
    danger: true, ...canOpt(opts.can?.remove), success: t`Deleted`,
    ...(opts.reason?.remove ? { reason: opts.reason.remove } : { confirm: (row: R) => t`Delete "${row["name"] ?? row["title"] ?? row[key]}"?` }),
  });

  return h<TableProps<R>>(Table, {
    table,
    rowActions: [edit, ...(opts.rowActions ?? []), remove].filter((a): a is RowAction<R> => !!a),
    bulkActions: opts.bulkActions,
    expand: opts.expand,
    empty: opts.empty,
    onRowClick: edit ? (row: R) => edit.run(row).catch(() => {}) : undefined,
    toolbarEnd: create ? h(Button, { variant: "primary", onClick: () => create.run().catch(() => {}), hidden: () => !create.visible() }, L.create) : null,
  });
}
