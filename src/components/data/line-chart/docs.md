# LineChart

Line, area and combo charts from rows of objects. `x` picks the x value (dates give a time axis, numbers a linear one,
anything else categories), `y` one series or a list of them. `AreaChart` (same folder) fills under the lines and can
stack them; `ComboChart` draws bars and lines on one x axis, often with a second value axis. A series can be a plain key
or `{ key, value, label, type, axis, curve, dash, marker }`. Data may be a signal or a function: the chart follows it and
its container's width. Long series are downsampled (LTTB).

```tsx
<LineChart data={$days} x="day" y={["income", "spend"]} series={{ income: "Income", spend: "Spending" }}
  format={["money", "USD"]} curve="smooth" markers="auto" zoom title="Income and spending"
  marks={[{ y: 5000, label: "Target", color: "success" }, { y: "average", series: "spend" }]} />
<AreaChart data={$days} x="day" y={["web", "app"]} stacked offset="expand" height={200} />
<ComboChart data={$months} x="month" y={[{ key: "orders", type: "bar" }, { key: "margin", type: "line", axis: "right", curve: "smooth" }]}
  y2Format="percent" yTitle="Orders" y2Title="Margin" />
<LineChart data={$ticks} x="t" y="price" window={{ ms: 60_000 }} navigator sync="market" />
```

## Props

| Prop | |
|---|---|
| `data` | Rows: an array, a signal or a function returning one. |
| `x` | The x value: a key or `(row, i) => value`. Default: the index. |
| `y` | A series key or getter, `{ key, value, label, type, axis, curve, dash, marker }`, or a list of them. Default "y". |
| `series` | Series labels (legend, tooltip, table): a list aligned with `y`, `{ key: label }` or one label. |
| `xType` | Forces the x scale: "time", "linear" or "band". |
| `xFormat` / `format` / `y2Format` | Formats of the x labels, the left values and the right values: a pipe name, `[pipe, ...args]` or a function. |
| `yMin` / `yMax` / `y2Min` / `y2Max` / `zero` | The value axis ranges (rounded to nice ticks); `zero` includes 0. |
| `xTitle` / `yTitle` / `y2Title` | Axis titles. |
| `grid` | `true` (horizontal, default), `false`, "x" (vertical only) or "both". |
| `curve` | "linear" (default), "smooth" (monotone, never overshoots), "step", "step-before", "step-after". |
| `markers` | Point markers: `true`, "circle", "square", "diamond", "triangle" or "auto" (only when points are few). |
| `connectNulls` | Draws across missing values; by default a null leaves a gap. |
| `marks` | Reference lines, bands, statistics and notes: `{ y }`, `{ y: [a, b] }`, `{ y: "average" \| "median" \| "min" \| "max", series }`, `{ x }`, `{ x: [from, to] }`, `{ at: [x, y] }`; each with `label`, `color` (theme token), `dash`, `axis`, `class`. |
| `window` | Live data: the last N rows, `{ last }` or `{ ms }` (a time span); the data may keep growing and the plot slides. |
| `navigator` | A range navigator under the chart (`true` or its height): drag the window, pull its edges, double click resets. |
| `sync` | Charts with the same name share the crosshair and tooltip position. |
| `zoom` / `resetLabel` | Drag across the plot to zoom into an x range; double click, Escape or the reset button resets. |
| `maxPoints` | Above this many points a series is downsampled. Default 2 × plot width. |
| `stacked` / `offset` | AreaChart: stack the visible area series; baseline "zero", "expand" (shares of 100 %), "silhouette" or "wiggle". |
| `animate` | Change animations (see Motion). Default on. |
| `export` | Export buttons: `true` (PNG, SVG, CSV), a list of formats or `{ formats, filename, labels, scale, background, onExport }`. |
| `legend` | `true`, `false`, "bottom" or "right"; by default shown when there are several series. Items toggle series. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed point (`{ x, y, series, datum, values }`). |
| `title` / `description` | Accessible name (SVG title, table caption) and longer description. |
| `xLabel` / `empty` / `colors` / `width` / `height` / `class` | Table x header, no-data content, per-series colors, size (default: container width × 240). |

## Motion

The chart lives in data space: on a data change the x and value domains and every point tween on the motion engine,
points matched by their x. So appended live data slides in from the right while the axis glides, values morph in place,
a resampled line stays where it is, and a series hidden in the legend sinks to its base (stacked layers close up). The
first draw rises from the baseline as a wave from left to right. Bars of a combo chart grow from the baseline.

`animate`: `true` (default, a spring), `false`, an easing name ("out", "bounce", "spring-wobbly"…),
`{ duration, easing, stagger, delay, enter, update, exit }` (stagger is per series), or `({ index, key, phase }) => …`
deciding per series. Everything runs on the engine clock: global speed, pause and reduced motion (the chart jumps) apply.

## Accessibility

- The SVG has a title and description; a visually hidden data table carries every value for screen readers (and the
  CSV export).
- Tab reaches the plot; ← → move between points, Home / End jump to the ends, Enter selects, Escape resets zoom; the
  tooltip follows the keyboard point.
- Legend items are toggle buttons with `aria-pressed`; the navigator's edges are sliders (arrows, Shift for big steps,
  Home / End, Escape resets).
