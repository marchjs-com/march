# BarList

Ranked horizontal bars with their labels and values: top pages, countries, products, songs. Rows are sorted largest
first (unless `sort={false}`), can be cut to the first N (`limit`) and become buttons with `onSelect`. A long label
scrolls into view when it does not fit (OverflowText). Data may be a signal or a function.

```tsx
<BarList data={$songs} x="title" y="plays" title="Most played" />
<BarList data={countries} limit={5} format="compact" color={2} onSelect={(r) => open(r.datum)} />
<BarList data={tasks} sort={false} max={100} format={(v) => `${v}%`} />
```

## Props

| Prop | |
|---|---|
| `data` | Rows: an array, a signal or a function returning one. |
| `x` / `y` | The row label and value: keys or getters. Defaults "label" and "value". |
| `sort` | Largest first. Default true. |
| `limit` | Show only the first N rows. |
| `max` | The value of a full bar. Default: the largest value. |
| `format` | Value format: a pipe name, `[pipe, ...args]` or a function. Default "number". |
| `color` / `colors` | Palette slot (0-based) or colors overriding the palette. |
| `onSelect` | Makes rows buttons; called with the row and its rank (`{ label, value, rank, datum }`). |
| `title` | Accessible name of the list. |
| `empty` / `class` | No-data content (default "No data") and extra classes on the root. |
| `animate` | Change animation: `true` (default, a spring), `false`, an easing name or `{ duration, easing, stagger, delay, enter, update, exit }`. |

## Accessibility

- The list is a `role="list"` named by `title`; each row is a list item with its label and formatted value as text.
- With `onSelect` each row is a real button (Tab, Enter, Space).
- The bar is decoration (`aria-hidden`); the value is always written next to it.
- A row that is leaving is hidden from screen readers and takes no clicks while it shrinks away.

## Motion

- Bars grow in from 0 when first drawn, one after another with `stagger` (`animate={{ stagger: 60 }}`).
- On new data the widths morph to the new values, and rows whose rank changed glide to their new place (FLIP: the
  list reorders at once and each row's offset tweens back to 0).
- Rows that leave (removed, or cut by `limit`) shrink and fade in their old place, then go; the rows below close up
  with a glide.
- All tweens run on the motion engine: `animate={false}` jumps, reduced motion jumps, global speed and pause apply.

Composed of OverflowText (long labels).
