# crud (`hadi-march/crud`)

`crud(source, options)` returns a complete list/create/edit/delete view built from `Table`, `Form`, dialogs and `action()`.

```jsx
const Product = schema({
  name: { type: "text", required: true, max: 80 },
  price: { type: "money", currency: "EUR", min: 0 },
  status: { type: "pick", options: ["draft", "live"], default: "draft" },
  updatedAt: { type: "datetime", readonly: true },
})

const source = {
  list: (p) => fetchJson(`/api/products?page=${p.page}&size=${p.size}&q=${p.search ?? ""}`), // → { items, total }
  get: (id) => fetchJson(`/api/products/${id}`),                 // optional: fresh record before editing
  create: (v) => fetchJson("/api/products", { method: "POST", body: v }),
  update: (id, v, { changed, reason }) => fetchJson(`/api/products/${id}`, { method: "PATCH", body: changed }),
  remove: (id, reason) => fetchJson(`/api/products/${id}`, { method: "DELETE" }),
}

export default function Products() {
  return <Page title="Products">{crud(source, { schema: Product, urlKey: "p", reason: { remove: 10 } })}</Page>
}
```

| Option | Meaning |
|---|---|
| `schema` | columns and form fields (readonly fields are shown in the table but not edited) |
| `formSchema` | a different schema for the form |
| `mode` | `"server"` (default: `list(params)` returns `{ items, total }` or `{ items, nextCursor }`) or `"client"` (`list()` returns an array) |
| `rowKey` | id field (default `"id"`) |
| `columns` | explicit table columns instead of `schema.columns()` |
| `rowActions`, `bulkActions` | extra `action()` objects (edit and delete are added automatically) |
| `can` | `{ create, update, remove }` permissions (actions disappear when not allowed) |
| `reason` | `{ save: min, remove: min }` asks for a reason before saving / deleting |
| `labels` | `{ create, edit, remove }` texts |
| `urlKey`, `storageKey`, `paging`, `pageSize`, `expand`, `empty`, `dialogSize` | passed to the table / dialog |

Clicking a row opens the editor. Saving re-fetches the list; server field errors (`err.fieldErrors`) appear on the fields.
