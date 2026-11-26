# Heatmap

Intensities on a grid: `x` picks the column, `y` the row and `value` the number (duplicates are summed); cells take
`levels` tones of the theme accent. With `calendar` the columns are weeks and the rows the days of the week, the way a
habit or a contribution graph reads: month names over the weeks, Monday / Wednesday / Friday on the side (the week
starts on the locale's first day, from Intl), a "less → more" legend under it, and gaps for the days outside the range.
`from` and `to` give a whole year (53 weeks). Data may be a signal or a function; cells fade to their new tone.

```tsx
<Heatmap data={visits} x="hour" y="day" value="people" yFormat={(d) => DAYS[d]} title="Café traffic" />
<Heatmap data={commits} x="date" value="count" calendar from="2026-01-01" to="2026-12-31" cellSize={11} radius={3} />
<Heatmap data={pages} x="date" value="pages" calendar={{ weeks: 16 }} to="2026-11-20" levels={4} animate={{ stagger: 8 }} />
<Heatmap data={errors} x="service" y="region" value="count" cellSize={20} max={50} onSelect={(c) => open(c)} />
```

## Props

| Prop | |
|---|---|
| `data` | Rows: an array, a signal or a function returning one. |
| `x` / `y` / `value` | Column, row and value: keys or getters (defaults "x", "y", "value"). In calendar mode `x` is a date. |
| `calendar` | `true` or `{ weeks }` (default 12): weeks × days of the week. |
| `from` / `to` | First and last day of the calendar; days outside are gaps. Default: `weeks` whole weeks up to the latest date in the data. `end` is the older name of `to`. |
| `firstDay` | First day of the week, 0 = Sunday … 6 = Saturday. Default: the locale's (Intl week info). |
| `months` | Month names over the weeks (calendar). Default true. |
| `dayLabels` | Weekday names on the side (calendar): `true` (Mon, Wed, Fri), "all" or `false`. |
| `levelLegend` | The "less → more" legend: `true`, `false` or `{ less, more }`. Default on in calendar mode. |
| `xFormat` / `yFormat` / `format` | Formats of the column labels (in calendar mode: the date in the tooltip, default the locale's long date), row labels and values. |
| `xDomain` / `yDomain` | Order (and completeness) of the columns and rows. Default: data order. |
| `levels` | Number of tones. Default 5 (level 0 = empty or ≤ 0). |
| `max` | Value of the top tone. Default: the data maximum. |
| `cellSize` / `gap` / `radius` | Square size, space between cells and corner radius in px. Default: fits the width (at most 30), 2 (1 when tiny), 2. Half the size makes dots. |
| `cell` | Fixed pitch (square + gap) in px: the older form of `cellSize`. |
| `animate` | Change animation: `true` (default, a spring), `false`, an easing name or `{ duration, easing, stagger, delay, enter, update, exit }`. |
| `valueLabel` | Label of the value in the tooltip. Default "Value". |
| `tooltip` | `true` (default), `false` or `(cell) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed cell (`{ x, y, value, label, datum }`; in calendar mode `x` and `datum.date` are the day). |
| `title` / `description` / `empty` / `class` / `width` / `height` / `export` | Accessible name, longer description, no-data content, extra classes, size, export buttons. |

`heatLevel(value, max, levels)` gives the tone of a value for your own drawing.

## Accessibility

- The SVG has a title and description; a visually hidden data table carries every cell (rows: days of the week or
  `y`, columns: weeks or `x`).
- Tab reaches the grid. In a grid the arrow keys move between cells; in a calendar ↑ ↓ move one day and ← → one week;
  Home / End go to the first / last cell; Enter or Space selects, Escape clears. The tooltip follows the keyboard cell
  and says the date (calendar) and the value.
- Tones never carry meaning alone: every cell's value is in the tooltip and the table.

## Motion

- Cells pop in from their middle when first drawn; with `stagger` they come as a diagonal wave (delay = stagger ×
  (column + row)).
- When the values change, cells fade to their new tone (a CSS transition with the easing and length of `animate`).
- When a calendar moves on (a new `to`), the days glide to their new column; days that leave the range shrink away
  before they are removed (presence).
- `animate={false}` draws at once; reduced motion jumps; global speed and pause reach the tweens.
