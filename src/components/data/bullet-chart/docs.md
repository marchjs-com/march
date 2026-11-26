# BulletChart

A measure against its goal in little room: the bar is the measure, the tick is the target, the shaded bands behind are
the qualitative ranges (poor / satisfactory / good) and a thin dashed marker shows a comparison such as last period.
One row per measure with its name and subtitle; columns with `orientation="vertical"`; `compact` thin rows for tables.

```tsx
<BulletChart data={$kpis} title="Quarter KPIs" />
<BulletChart data={{ label: "Revenue", value: 270, target: 250, ranges: [150, 225, 300] }} compact />
<BulletChart data={teams} label="team" value="sold" target="quota" ranges={[50, 80, 100]} rangeTone="traffic" orientation="vertical" />
```

## Props

| Prop | |
|---|---|
| `data` | Rows, one measure each, or a single object: an array, a signal or a function returning one. |
| `label` / `subtitle` | Row name and the smaller line under it: keys or getters. Default "label", "subtitle". |
| `value` / `target` / `previous` | The measure (bar), the target (tick) and a comparison (dashed marker): keys or getters. Defaults "value", "target", "previous". |
| `ranges` | Range ends, ascending: a key or getter giving an array (default "ranges"), or one array for every row. |
| `rangeLabels` | Names of the ranges for tooltip and table. Default "Poor", "Satisfactory", "Good". |
| `rangeTone` | `"neutral"` (default, shades) or `"traffic"` (bad / warning / good tints). |
| `min` / `max` | Scale ends: `min` a number (default 0); `max` a number or a key / getter per row (default the largest value, rounded). |
| `sharedScale` | One scale for every row. |
| `orientation` | `"horizontal"` (default) or `"vertical"`. |
| `compact` | Thin rows without subtitles and ticks, for tables. |
| `axis` / `showValue` / `names` | Tick values, the value beside the bar, the names column. Default true. |
| `rowHeight` | Height of one row in px (default 58; 42 without axis; 26 compact); the chart's height follows the rows. |
| `color` | Bar color: a theme token or CSS color (default the accent). `colors` = `[bar, target, previous]`. |
| `format` | Value format: a pipe name, `[pipe, ...args]` or a function. Default "number". |
| `animate` | `true` (default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `legend` | `true`, "bottom" or "right": Value / Target / Previous items that hide / show those marks. Default off. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed row (`{ label, value, target, previous, ranges, range, datum }`). |
| `title` / `description` / `xLabel` / `empty` / `width` / `height` / `class` / `export` | Accessible name, table header, no-data content, size, export buttons. |

Class hooks: `m-bullet-row`, `m-bullet-range` (`m-bullet-range-0…`), `m-bullet-bar`, `m-bullet-target`, `m-bullet-prev`,
`m-bullet-name`, `m-bullet-sub`, `m-bullet-value`, `m-bullet-tick`; CSS tokens `--m-bullet-bar`, `--m-bullet-target`,
`--m-bullet-previous`, `--m-bullet-range`.

## Motion

- Enter: row after row (80 ms apart) the ranges fade in and grow, the bar fills to its value, the target tick and the
  previous marker slide in from the start of the scale.
- Update: bar, ticks and range ends glide to their new place (a spring); rows glide to a new order.
- Exit: a leaving row's bar empties while the row fades, then it is removed.
- `animate={false}` draws in place; reduced motion jumps.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists every measure with value, target, previous
  and the range it falls in.
- Tab reaches the chart; ↑ ↓ (or ← →) move between rows, Enter / Space selects, Escape clears; the tooltip follows the
  keyboard row, which is highlighted.
