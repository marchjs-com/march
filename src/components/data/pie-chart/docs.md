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
| `animate` | On a data change the slices turn: `true` (a spring) or an easing name. Default off. |
| `format` | Value format: a pipe name, `[pipe, ...args]` or a function. |
| `legend` | `true`, `false`, "bottom" or "right". Items toggle slices. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed slice (`{ label, value, share, datum }`). |
| `title` / `description` | Accessible name (SVG title, table caption) and longer description. |
| `xLabel` / `yLabel` / `empty` / `colors` / `width` / `height` / `class` | Table headers, no-data content, per-slice colors, size. |

`pieLayout(values)` and `arcPath(...)` give the angles and SVG paths for your own drawing.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists every slice with its value.
- Tab reaches the chart; ← → move between slices, Enter selects; the tooltip follows the keyboard slice.
- With reduced motion slices take their new angles in place. Legend items are toggle buttons with `aria-pressed`.
