# LineChart

Line and area charts from rows of objects. `x` picks the x value (dates give a time axis, numbers a linear one, anything
else categories), `y` one series or a list of them. `AreaChart` (same folder) fills under the lines and can stack them.
Data may be a signal or a function: the chart follows it and its container's width. Long series are downsampled (LTTB).

```tsx
<LineChart data={$days} x="day" y={["income", "spend"]} series={{ income: "Income", spend: "Spending" }}
  format={["money", "USD"]} xFormat="date" zoom title="Income and spending" />
<AreaChart data={$days} x="day" y={["web", "app"]} stacked height={200} />
<LineChart data={temps} x="hour" y="c" zero={false} legend={false} onSelect={(p) => open(p.datum)} />
```

## Props

| Prop | |
|---|---|
| `data` | Rows: an array, a signal or a function returning one. |
| `x` | The x value: a key or `(row, i) => value`. Default: the index. |
| `y` | A series key or getter, or a list of them. Default "y". |
| `series` | Series labels (legend, tooltip, table): a list aligned with `y`, `{ key: label }` or one label. |
| `xType` | Forces the x scale: "time", "linear" or "band". |
| `xFormat` / `format` | Formats of the x labels and of the values: a pipe name, `[pipe, ...args]` or a function. |
| `yMin` / `yMax` / `zero` | The value axis range (rounded to nice ticks); `zero` includes 0. |
| `grid` | `true` (horizontal, default), `false`, "x" or "both". |
| `zoom` | Drag across the plot to zoom into an x range; double click, Escape or "Reset zoom" resets. |
| `maxPoints` | Above this many points a series is downsampled. Default 2 × plot width. |
| `legend` | `true`, `false`, "bottom" or "right"; by default shown when there are several series. Items toggle series. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed point (`{ x, y, series, datum, values }`). |
| `stacked` | AreaChart: stacks the visible series. |
| `title` / `description` | Accessible name (SVG title, table caption) and longer description. |
| `xLabel` / `empty` / `colors` / `width` / `height` / `class` | Table x header, no-data content, per-series colors, size (default: container width × 240). |

## Accessibility

- The SVG has a title and description; a visually hidden data table carries every value for screen readers.
- Tab reaches the plot; ← → move between points, Home / End jump to the ends, Enter selects; the tooltip follows the
  keyboard point.
- Legend items are toggle buttons with `aria-pressed`.
