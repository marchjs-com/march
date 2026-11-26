# ScatterChart

Points on two numeric (or time) axes. Give `size` and it becomes a bubble chart (the bubble's area follows the value),
`group` colors the points by series with a symbol each and a legend that toggles them, `trend` fits a least-squares
line per series and writes its r², and `marks` draws quadrant lines, targets and notes. The nearest point to the
pointer answers (no voronoi), the keyboard walks the points from left to right.

```tsx
<ScatterChart data={$cities} x="income" y="happiness" size="population" group="region" label="city"
  trend="linear" marks={[{ x: 50000 }, { y: 6.5, label: "Mutluluk ortası" }]} title="Gelir ve mutluluk" />
<ScatterChart data={readings} x="time" y="temp" shape="diamond" radius={3} animate={{ stagger: 15 }} />
```

## Props

| Prop | |
|---|---|
| `data` | Rows: an array, a signal or a function returning one. |
| `x` / `y` | The coordinates: a key or `(row, i) => value`. Default "x" and "y"; dates make a time x axis. |
| `size` | Bubble size: a key or getter. The area grows with the value between `sizeRange` (default [4, 26] px radius). |
| `radius` | Point radius without `size`. Default 5. |
| `group` / `groupLabels` | Series of a point (colors, symbols, legend toggles) and `{ value: label }` names for them. |
| `label` / `key` | The point's name (tooltip, table) and its identity across data changes (default the label, else the index). |
| `shape` | "circle" (default), "square", "diamond", "triangle", a list by series or "auto" (one each in turn). |
| `trend` / `trendLabel` | `"linear"`: a least-squares line per series; its text: r² by default, `false` or `(fit) => text`. |
| `marks` | Reference lines, bands and point notes (`{ x }`, `{ y }`, `{ y: [a, b] }`, `{ at: [x, y] }`, `{ y: "average" }`). |
| `xType` | "linear" or "time" (default detected). |
| `xFormat` / `format` / `sizeFormat` | Formats of x, y and size: a pipe name, `[pipe, ...args]` or a function. |
| `xMin` / `xMax` / `yMin` / `yMax` | Fixed axis ends (rounded to nice ticks). |
| `grid` | `true` (both ways, default), `false`, "x" or "y". |
| `xTitle` / `yTitle` | Axis titles. |
| `xLabel` / `yLabel` / `sizeLabel` | Names of x, y and size in the tooltip and the table. |
| `animate` | `true` (spring, default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed point (`{ x, y, size, group, label, datum }`). |
| `legend` | `true`, `false`, "bottom" or "right"; shown with two or more series. |
| `title` / `description` / `empty` / `colors` / `width` / `height` / `class` / `export` | As on every chart (default height 300). |

`linearFit(points)` and `symbolPath(shape, r)` are exported for your own drawing.

## Accessibility

- The SVG has a title and description; a visually hidden table lists every point (name, series, x, y, size).
- Tab reaches the plot; ← → walk the points in x order, Home / End jump to the ends, Enter selects, Escape clears.
  The tooltip, a ring and guide lines to both axes follow the keyboard point.
- Series are told apart by symbol as well as color. Legend items are toggle buttons with `aria-pressed`.

## Motion

Points grow from nothing (with `stagger` they sweep in from left to right), glide to their new x, y and radius when
the data changes, and shrink away when they leave or their series is hidden; the axes take the new scale and the
points follow. A trend line draws itself from its left end and swings to its new slope. Reduced motion: everything
jumps to its place.
