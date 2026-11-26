# WaterfallChart

How a start value becomes an end value, step by step: each increase or decrease floats from where the previous one
ended, subtotals and the total stand on the axis. Increases, decreases and totals take the theme's good / bad /
neutral colors (override with `upColor`, `downColor`, `totalColor`), dashed connectors join the bars and every bar
carries its signed value.

```tsx
<WaterfallChart data={$pnl} start={120000} totals="end" format="compact" title="Profit bridge" />
<WaterfallChart data={cash} x="month" y="net" horizontal upColor="brand-blue" downColor="brand-orange" />
<WaterfallChart data={rows} total="isSubtotal" marks={[{ y: 100000, label: "Goal" }]} connectors={false} />
```

A row whose `total` field is truthy is a subtotal: it shows the running total at that point and its own value is
ignored.

## Props

| Prop | |
|---|---|
| `data` | Rows, one step each (or a subtotal row): an array, a signal or a function returning one. |
| `x` | The column label: a key or getter. Default "label". |
| `y` | The step, positive or negative: a key or getter. Default "value". |
| `start` / `startLabel` | A start value, drawn as the first column from zero; its label (default "Start"). |
| `total` | Marks subtotal rows: a key or getter, truthy on them. Default "total". |
| `totals` / `totalLabel` | `"end"` (or `true`) adds a total column at the end; its label (default "Total"). |
| `connectors` | Dashed lines from each bar's end to the next bar. Default true. |
| `labels` | Value labels: `true` (default, +/− on steps), `false`, or `(point) => string`. |
| `upColor` / `downColor` / `totalColor` | Theme tokens ("success", "brand-blue", "good", "bad", "neutral"…) or CSS colors. `colors` = `[up, down, total]` works too. |
| `horizontal` / `orientation` | Columns on the y axis, bars run to the right. |
| `format` | Value format: a pipe name, `[pipe, ...args]` or a function. Default "number". |
| `yMin` / `yMax` / `grid` | Fix the value axis ends; grid lines (default true). |
| `marks` | Reference marks (vertical layout): `{ y }` lines, `{ y: [a, b] }` bands, `{ y: "average" }` of the running totals, `{ x: "Q1" }`. |
| `animate` | `true` (default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `legend` | `true`, "bottom" or "right": Increase / Decrease / Total items that hide / show that kind. Default off. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed column (`{ label, kind, value, from, to, datum }`). |
| `title` / `description` / `xLabel` / `yLabel` / `empty` / `width` / `height` / `class` / `export` | Accessible name, table headers, no-data content, size, export buttons. |

Class hooks: `m-waterfall-step`, `m-waterfall-up|down|total`, `m-waterfall-bar`, `m-waterfall-label`, `m-waterfall-link`;
CSS tokens `--m-waterfall-up`, `--m-waterfall-down`, `--m-waterfall-total`.

## Motion

- Enter: the bars build one after another (110 ms apart): each floats out of the previous bar's end, totals rise from
  the axis; connectors draw out with the bar they lead to.
- Update: bars glide to their new start and end (a spring), connectors follow.
- Exit: a leaving bar shrinks back to where it started, then it is removed.
- `animate={false}` draws in place; reduced motion jumps.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists each step, its change and the running total.
- Tab reaches the chart; ← → move between columns, Enter / Space selects, Escape clears; the tooltip (change and
  running total) follows the keyboard column, which gets a focus outline.
