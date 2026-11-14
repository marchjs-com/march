# KeyValue

A definition list (`<dl>`) for detail views: one label / value pair per row, in up to four columns. Values may be text,
nodes or accessors; an empty value shows a placeholder.

```tsx
<KeyValue columns={2} items={[{ label: "Email", value: user.email }, { label: "Total", value: total, hint: "incl. VAT" }]} />
<KeyValue items={{ Plan: "Business", Seats: 48 }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ label, value, hint?, hidden? }[]` or an object | — | rows; object keys become labels |
| `columns` | 1–4 | `1` | columns; fewer on narrow screens (2 below 1024 px, 1 below 640 px) |
| `empty` | node | `—` | shown for null / empty values |
| `class` | class | — | extra class on the list |

Parts carry stable classes: `m-kv-row`, `m-kv-label`, `m-kv-value`, `m-kv-hint`.

## Accessibility

A real `<dl>` with `<dt>` / `<dd>`: screen readers announce each pair. Long values wrap instead of overflowing.

## Composed of

StatTile (every row: `term`, `emphasis="text"`, the hint inside the value).
