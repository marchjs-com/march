# Heatmap

Intensities on a grid: `x` picks the column, `y` the row and `value` the number (duplicates are summed); cells take
`levels` tones of the theme accent. With `calendar` the columns are weeks and the rows weekdays, the way a habit or a
contribution graph reads. Data may be a signal or a function; with `animate` cells fade to their new tone.

```tsx
<Heatmap data={visits} x="hour" y="day" value="people" yFormat={(d) => DAYS[d]} title="Café traffic" />
<Heatmap data={pages} x="date" value="pages" calendar={{ weeks: 16 }} end="2026-11-20" levels={4} />
<Heatmap data={errors} x="service" y="region" value="count" cell={20} max={50} onSelect={(c) => open(c)} />
```

## Props

| Prop | |
|---|---|
| `data` | Rows: an array, a signal or a function returning one. |
| `x` / `y` / `value` | Column, row and value: keys or getters (defaults "x", "y", "value"). In calendar mode `x` is a date. |
| `calendar` | `true` or `{ weeks }` (default 12): weeks × Monday…Sunday. `end` is the last day (default the latest date). |
| `xFormat` / `yFormat` / `format` | Formats of the column labels, row labels and values. |
| `xDomain` / `yDomain` | Order (and completeness) of the columns and rows. Default: data order. |
| `levels` | Number of tones. Default 5 (level 0 = empty or ≤ 0). |
| `max` | Value of the top tone. Default: the data maximum. |
| `cell` | Fixed cell size in px. Default: fits the width, at most 32. |
| `animate` | On a data change cells fade to their new tone: `true` or an easing name. Default off. |
| `valueLabel` | Label of the value in the tooltip. Default "Value". |
| `tooltip` | `true` (default), `false` or `(cell) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed cell (`{ x, y, value, label }`). |
| `title` / `description` / `empty` / `class` | Accessible name, longer description, no-data content, extra classes. |

`heatLevel(value, max, levels)` gives the tone of a value for your own drawing.

## Accessibility

- The SVG has a title and description; a visually hidden data table carries every cell.
- Tab reaches the grid; the arrow keys move between cells, Enter selects; the tooltip follows the keyboard cell.
- Tones never carry meaning alone: every cell's value is in the tooltip and the table.
