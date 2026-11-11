// crud(): a complete list/create/edit/delete screen from a data source and a schema.
//   {crud({ list, create, update, remove }, { schema: Product, title: "Products" })}
// list(params) → { items, total? , nextCursor? } (server mode, params from the table: page, size, sort, filters, search…)
//   or an array (client mode: sorting/filtering/paging in the browser). Built from Table, Form, Dialog and action().
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { query } from "../data/index.ts";
import type { Schema } from "../schema/index.ts";
import type { PermCheck } from "../access/index.ts";
import { createTable, Table } from "../table/index.js";
import { Form } from "../forms/index.js";
import { openDialog, askReason } from "../ui/dialog.js";
import { Button } from "../ui/button.js";
import { action } from "../ui/action.js";

type Row = Record<string, unknown>;
/** Server-mode page (`list` may also return a plain array in client mode). */
export interface CrudPage<R> { items: R[]; total?: number; nextCursor?: unknown }
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
  columns?: unknown[];
  mode?: "server" | "client";
  rowActions?: unknown[];
  bulkActions?: unknown[];
  urlKey?: string;
  storageKey?: string;
  paging?: unknown;
  pageSize?: number;
  can?: { create?: PermCheck; update?: PermCheck; remove?: PermCheck };
  /** Ask for a reason (minimum length) before saving / deleting. */
  reason?: { save?: number; remove?: number };
  labels?: { create?: string; edit?: string; remove?: string };
  expand?: (row: R) => unknown;
  empty?: unknown;
  dialogSize?: "sm" | "md" | "lg" | "full";
}

interface ActionLike { run: (...a: unknown[]) => Promise<unknown>; visible: () => boolean }
type DialogFn = (render: (close: (v: unknown) => void) => unknown, opts: Record<string, unknown>) => Promise<unknown>;
type ActionFn = (label: string, fn: (...a: never[]) => unknown, opts: Record<string, unknown>) => ActionLike;
type TableFactory = (opts: Record<string, unknown>) => { refetch: () => unknown };

export function crud<R extends Row = Row>(source: CrudSource<R>, opts: CrudOptions<R>): unknown {
  const key = opts.rowKey ?? "id";
  const base = opts.schema as Schema<Row>;
  const formSchema = (opts.formSchema as Schema<Row> | undefined) ?? base.omit(...base.fields.filter((f) => f.readonly).map((f) => f.name));
  const L = { create: t`New`, edit: t`Edit`, remove: t`Delete`, ...(opts.labels ?? {}) };
  const client = opts.mode === "client";
  const rows = client ? query(({ signal }) => source.list({ signal }), { key: ["crud", opts.title ?? "items"] }) : null;
  const table = (createTable as unknown as TableFactory)({
    ...(rows ? { rows: () => rows() ?? [], loading: () => rows.loading(), error: () => rows.error() } : { source: (p: Record<string, unknown>) => source.list(p) }),
    schema: opts.columns ? undefined : opts.schema, columns: opts.columns, rowKey: key,
    urlKey: opts.urlKey, storageKey: opts.storageKey, paging: opts.paging, pageSize: opts.pageSize,
  });
  const refresh = (): unknown => (rows ? rows.refetch() : table.refetch());
  const dialog = openDialog as unknown as DialogFn;
  const act = action as unknown as ActionFn;

  const editor = (title: string, initial: unknown, submit: (values: Partial<R>, form: unknown) => Promise<unknown>): Promise<unknown> => dialog((close) => h(Form as unknown as (p: Record<string, unknown>) => unknown, {
    schema: formSchema, initial, cancel: () => close(null),
    onSubmit: async (values: Partial<R>, form: unknown) => { const r = await submit(values, form); close(r ?? true); },
  }), { title, size: opts.dialogSize ?? "md" });

  const create = source.create && act(L.create, async () => {
    const r = await editor(L.create, formSchema.defaults(), (v) => (source.create as NonNullable<CrudSource<R>["create"]>)(v));
    if (r !== null) await refresh();
    return r;
  }, { can: opts.can?.create, success: false });

  const edit = source.update && act(L.edit, async (row: R) => {
    const initial = source.get ? await source.get(row[key]) : row;
    const r = await editor(L.edit, initial, async (values) => {
      const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((initial as Row | undefined)?.[k]))) as Partial<R>;
      let reason: string | undefined;
      if (opts.reason?.save) {
        reason = (await (askReason as unknown as (o: Record<string, unknown>) => Promise<string | null | undefined>)({ title: L.edit, min: opts.reason.save })) as string | undefined;
        if (reason == null) throw Object.assign(new Error(t`Cancelled`), { code: "cancelled" });
      }
      return (source.update as NonNullable<CrudSource<R>["update"]>)(row[key], values, { changed, reason });
    });
    if (r !== null) await refresh();
    return r;
  }, { can: opts.can?.update, success: false });

  const remove = source.remove && act(L.remove, async (row: R, reason?: string) => { await (source.remove as NonNullable<CrudSource<R>["remove"]>)(row[key], reason); await refresh(); }, {
    danger: true, can: opts.can?.remove, success: t`Deleted`,
    ...(opts.reason?.remove ? { reason: opts.reason.remove } : { confirm: (row: R) => t`Delete "${row["name"] ?? row["title"] ?? row[key]}"?` }),
  });

  return h(Table as unknown as (p: Record<string, unknown>) => unknown, {
    table,
    rowActions: [edit, ...(opts.rowActions ?? []), remove].filter(Boolean),
    bulkActions: opts.bulkActions,
    expand: opts.expand,
    empty: opts.empty,
    onRowClick: edit ? (row: R) => edit.run(row).catch(() => {}) : undefined,
    toolbarEnd: create ? h(Button as unknown as (p: Record<string, unknown>) => unknown, { variant: "primary", onClick: () => create.run().catch(() => {}), hidden: () => !create.visible() }, L.create) : null,
  });
}
