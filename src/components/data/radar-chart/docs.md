# RadarChart

Compare several things over the same set of qualities. Every row is a spoke (`x` names it), every series in `y` is a
filled polygon with a dot on each value. The grid is a web of polygons or circles; all spokes share one scale (the
largest value, or `max`) or each has its own (`scale="axis"`, `axisMax`). Shapes grow out of the center, morph to new
values and shrink back into it when a series leaves.

```tsx
<RadarChart data={$skills} x="skill" y={["ada", "bora"]} series={["Ada", "Bora"]} max={10} title="Player skills" />
<RadarChart data={laptops} x="spec" y="score" gridShape="circle" curve="smooth" fill={0.35} levels={5} />
<RadarChart data={kpis} x="name" y={["thisYear", "lastYear"]} axisMax="target" fill={false} animate={{ stagger: 120 }} />
```

## Props

| Prop | |
|---|---|
| `data` | Rows, one spoke each: an array, a signal or a function returning one. |
| `x` | The spoke name: a key or getter. Default "label". |
| `y` | Value series: a key, a getter or a list of them (one polygon each). Default "value". |
| `series` | Series labels for legend, tooltip and table: aligned with `y`, by key, or one label. |
| `max` | The value at the rim on the shared scale. Default the largest value of every series. |
| `scale` | "shared" (default) or "axis": each spoke has its own max (`axisMax` or its largest value). |
| `axisMax` | Each spoke's max read from its row (a key or getter); turns on the "axis" scale. |
| `levels` | Grid rings. Default 4. |
| `gridShape` | "polygon" (default) or "circle". |
| `grid` | Grid rings and spokes. Default true. |
| `fill` | Fill opacity 0…1 (default 0.22); `false` draws lines only. |
| `dots` | A dot on every value. Default true. |
| `curve` | "linear" (default) or "smooth": a closed curve through the values. |
| `axisLabels` | Spoke names around the rim. Default true. Their text anchors follow the side and the text direction (RTL). |
| `levelLabels` | The value of each grid ring along the first spoke (shared scale). Default false. |
| `format` | Value format: a pipe name, `[pipe, ...args]` or a function. |
| `xLabel` | Header of the spoke column in the data table. Default "Axis". |
| `tooltip` | `true` (default), `false` or `(point) => content`. Point: `{ index, label, x, values, series, y, datum }`. |
| `onSelect` | Called with the spoke's point on click or Enter / Space. |
| `animate` | `true` (default spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `legend` | `true`, `false`, "bottom" or "right"; shown with two series or more. Items toggle series. |
| `title` / `description` / `empty` / `colors` / `width` / `height` / `class` / `export` | Accessible name and description, no-data content, per-series colors, size, extra class, export buttons. |

Class hooks: `m-radar-grid`, `m-radar-ring`, `m-radar-spoke`, `m-radar-label`, `m-radar-level`, `m-radar-series`,
`m-radar-shape`, `m-radar-dot`; `--m-radar-fill` is the fill opacity of a shape.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists every spoke with each series' value.
- Tab reaches the chart; ← → (↑ ↓, Home, End) move from spoke to spoke, Enter / Space selects, Escape clears. The
  tooltip follows the keyboard spoke, which is drawn dashed with its dots filled and its name in bold.
- Pointing anywhere in the web picks the nearest spoke. Legend items are toggle buttons with `aria-pressed`.

## Motion

- Enter: every shape grows out of the center (`stagger` delays series after series).
- Update: on new values (or a new `max`, a resize) the radii morph to their new lengths.
- Exit: a series that leaves (data or legend) shrinks back into the center before it is removed.
- `animate={false}` or reduced motion: shapes take their places at once.
