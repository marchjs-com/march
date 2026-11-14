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
<HonestCompare columns={…} rows={…} m:color="brand-green" tags={false} filter={false}
  labels={{ partly: "Half", behind: "We lose", counts: (c) => `${c.ahead} wins, ${c.behind} losses` }}
  renderCell={(value, { us }) => (value === true && us ? "✓✓" : undefined)} />   // undefined keeps the default mark
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
| `filter` | boolean | `true` | the "only where we are behind" toggle (the counts stay) |
| `tags` | boolean | `true` | the "Ahead" / "Behind" tags beside the row labels |
| `labels` | `{ yes, no, partly, ahead, behind, region, counts, onlyBehind, showAll }` | translated | every text the table writes; `counts`: `({ ahead, even, behind }) => node` |
| `renderCell` | `(value, { row, column, us, verdict }) => node` | — | draw a cell yourself; `undefined` keeps the default mark |
| `m:color` | color token | accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `class` | string | — | extra class on the root (`.m-hc`; parts: `.m-hc-summary`, `.m-hc-filter`, `.m-hc-table`, `.m-hc-us`, `.m-hc-tag`, `.m-hc-note`) |

`compareRow(row, us)` returns 1 (ahead), 0 (even), -1 (behind) or null (not scored).

## Accessibility

A real `table` with a caption, column headers (`scope="col"`) and row headers (`scope="row"`). Yes / no marks carry a
visually hidden "Yes" / "No"; "partly" is written out. The filter is a toggle button (`aria-pressed`); hidden rows use
`hidden`, so they leave the reading order too. The table scrolls sideways in a focusable region; the first column stays.

## Composed of

CheckMark (yes / no / partly), Badge (ahead / behind), Button (the filter toggle).
