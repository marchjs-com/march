# PieChart

Shares of a whole as a pie or a donut. `x` names each slice, `y` gives its value; the donut hole shows the formatted
total unless `center` says otherwise. Data may be a signal or a function; with `animate` the slices turn to their new
angles and a new slice opens from its edge.

```tsx
<PieChart data={$budget} x="label" y="value" donut format={["money", "USD"]} legend="right" title="Budget" />
<PieChart data={votes} donut={0.8} center="128 votes" legend="bottom" animate />
<PieChart data={traffic} padAngle={0.03} legend={false} onSelect={(p) => filter(p.label)} />
```

## Props

| Prop | |
|---|---|
| `data` | Rows: an array, a signal or a function returning one. |
| `x` | The slice label: a key or getter. Default "label". |
| `y` | The slice value: a key or getter. Default "value". |
| `donut` | `true` for a ring (inner radius 60 %) or an inner radius ratio 0…0.95. |
| `padAngle` | Gap between slices in radians. Default 0.01. |
| `center` | Content in the donut hole. Default: the formatted total. |
| `animate` | Change animations (see Motion). Default on. |
| `labels` | Text on the slices: "percent", "value", "label", `true` (= percent) or `false` (default). Thin slices stay bare. |
| `pop` | The active slice moves out by this many px (default 6; 0 keeps it in place). |
| `export` | Export buttons: `true` (PNG, SVG, CSV), a list of formats or options. |
| `format` | Value format: a pipe name, `[pipe, ...args]` or a function. |
| `legend` | `true`, `false`, "bottom" or "right". Items toggle slices. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed slice (`{ label, value, share, datum }`). |
| `title` / `description` | Accessible name (SVG title, table caption) and longer description. |
| `xLabel` / `yLabel` / `empty` / `colors` / `width` / `height` / `class` | Table headers, no-data content, per-slice colors, size. |

`pieLayout(values)` and `arcPath(...)` give the angles and SVG paths for your own drawing.

## Motion

Slices open from their start edge when first drawn, turn to new angles when the data changes and close onto their middle
before a removed slice disappears; the active slice pops out. `animate`: `true` (default, a spring), `false`, an easing
name, `{ duration, easing, stagger, delay, enter, update, exit }` or `({ index, key, phase }) => …`. On the engine clock:
global speed, pause and reduced motion apply.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists every slice with its value.
- Tab reaches the chart; ← → move between slices, Enter selects; the tooltip follows the keyboard slice.
- With reduced motion slices take their new angles in place. Legend items are toggle buttons with `aria-pressed`.
