# HonestCompare

A comparison table that also shows where the product is behind. A cell is `true` (yes), `false` (no), `"partial"` or
any text / node (not scored). In every scored row the `us` column is compared with the best other column: ahead, even
or behind. Behind rows get a mark and keep their `note` visible (why, what is planned). The summary counts the rows,
and a toggle shows only the rows where the product loses.

```tsx
<HonestCompare
  columns={[{ id: "us", name: "HADİ" }, { id: "events", name: "Event sites" }]}
  rows={[
    { label: "Nearby events by time", values: { us: true, events: "partial" } },
    { label: "Ticketing", values: { us: false, events: true }, note: "Not planned: HADİ is for free meetups." },
    { label: "Price", values: { us: "Free", events: "Fee per ticket" } },
  ]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `columns` | `{ id, name }[]` | — | the products |
| `rows` | `{ label, values, note? }[]` | — | `values`: one per column id |
| `us` | string | `"us"` | id of the product's own column |
| `caption` | node | "Comparison" | table caption |
| `showCaption` | boolean | `false` | caption visible (otherwise for screen readers only) |
| `summary` | boolean | `true` | counts and the "only where we are behind" toggle |

`compareRow(row, us)` returns 1 (ahead), 0 (even), -1 (behind) or null (not scored).

## Accessibility

A real `table` with a caption, column headers (`scope="col"`) and row headers (`scope="row"`). Yes / no marks carry a
visually hidden "Yes" / "No"; "partly" is written out. The filter is a toggle button (`aria-pressed`); hidden rows use
`hidden`, so they leave the reading order too. The table scrolls sideways in a focusable region; the first column stays.

## Composed of

Markup only; icons `check`, `x`, `minus`.
