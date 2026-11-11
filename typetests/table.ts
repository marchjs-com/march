// Type tests (tsc --noEmit): createTable<R> infers the row type from rows / source / schema; columns, actions typed by R.
import { createTable, Table, column, type Column, type TableState, type RowAction, type BulkAction } from "../src/table/index.ts";
import { schema } from "../src/schema/index.ts";
import { h } from "../src/dom/h.ts";

interface User { id: number; name: string; age: number | null }
const users: User[] = [{ id: 1, name: "Ada", age: 36 }];

// rows infer R; render / sortValue / value receive the row type
const t1 = createTable({
  rows: users,
  columns: [
    "name",
    { key: "age", align: "end", filter: "range", sortValue: (row) => row.age ?? 0 },
    { key: "initial", render: (row) => row.name.slice(0, 1), value: (row) => row.name[0] },
    // @ts-expect-error — row is a User: no `email`
    { key: "mail", render: (row) => row.email },
    // @ts-expect-error — key must be a string
    { key: 42 },
    // @ts-expect-error — unknown filter kind
    { key: "name", filter: "fuzzy" },
  ],
  rowKey: "id",
});
const s1: TableState<User> = t1;
const rows: readonly User[] = t1.rows();
const sel: User[] = t1.selectedRows();
// @ts-expect-error — rows are Users, not strings
const wrong: readonly string[] = t1.rows();
t1.toggle(users[0] as User, { range: true });
// @ts-expect-error — toggle takes a User
t1.toggle({ id: "x" });
void s1; void rows; void sel; void wrong;

// a typed column outside the call
const ageCol: Column<User> = { key: "age", format: (v, row) => `${v} (${row.name})` };
// @ts-expect-error — format's row is a User
const badCol: Column<User> = { key: "age", format: (_v, row) => row.missing };
const normalized = column<User>(ageCol);
const label: string = normalized.label;
void badCol; void label;

// server mode: R from source
const t2 = createTable({
  source: async (params) => ({ items: [{ id: 1, title: String(params.search ?? "") }], total: 1, nextCursor: null }),
  columns: [{ key: "title", render: (row) => row.title.toUpperCase() }],
  paging: "cursor",
});
const title: string | undefined = t2.rows()[0]?.title;
// @ts-expect-error — total is a number
createTable({ source: async () => ({ items: [], total: "1" }) });
void title;

// schema infers R
const Person = schema({ name: { type: "text", required: true }, born: "date" });
const t3 = createTable({ schema: Person, rows: [] });
const born: string | null | undefined = t3.rows()[0]?.born;
// @ts-expect-error — schema rows have no `age`
void t3.rows()[0]?.age;
void born;

// actions typed against R
const edit: RowAction<User> = { label: () => "Edit", run: async (row) => row.name };
const del: BulkAction<User> = { label: "Delete", run: async (rows) => rows.map((r) => r.id), busy: () => false };
// @ts-expect-error — a row action receives a User
const bad: RowAction<User> = { label: "x", run: async (row: string) => row };
void s1.runBulk(del);
void bad;

h(Table<User>, { rows: users, rowActions: [edit], bulkActions: [del], selectable: true, onRowClick: (row) => void row.name, expand: (row) => row.age });
// @ts-expect-error — expand gets a User
h(Table<User>, { rows: users, expand: (row) => row.nope });
