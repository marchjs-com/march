# BarChart

Bars from rows of objects: one series, several side by side (grouped) or on top of each other (`stacked`), standing up
or lying down (`horizontal`). Data may be a signal or a function; the bars glide to new values (`animate`) while the
axes take the new scale at once.

```tsx
<BarChart data={$week} x="day" y={["shop", "online"]} series={{ shop: "Shop", online: "Online" }}
  format={["money", "USD"]} animate title="Weekly sales" />
<BarChart data={$week} x="day" y={["shop", "online"]} stacked horizontal height={220} />
<BarChart data={langs} x="name" y="users" legend={false} onSelect={(p) => open(p.datum)} />
```

## Props

| Prop | |
|---|---|
| `data` | Rows: an array, a signal or a function returning one. |
| `x` | The category: a key or `(row, i) => value`. Default: the index. |
| `y` | A series key or getter, or a list of them. Default "y". |
| `series` | Series labels (legend, tooltip, table): a list aligned with `y`, `{ key: label }` or one label. |
| `stacked` | Stacks the visible series. |
| `horizontal` / `orientation` | Categories on the y axis, bars grow to the right ("vertical" is the default). |
| `animate` | Change animations (see Motion). Default on. |
| `labels` | Value labels: `true` / "outside", "inside" or `false` (default). |
| `marks` | Reference lines, bands and statistics on the value axis (vertical bars): `{ y }`, `{ y: [a, b] }`, `{ y: "average", series }`, `{ x: ["Mar", "May"] }`; with `label`, `color`, `dash`. |
| `export` | Export buttons: `true` (PNG, SVG, CSV), a list of formats or options. |
| `xFormat` / `format` | Formats of the category labels and of the values: a pipe name, `[pipe, ...args]` or a function. |
| `yMin` / `yMax` | The value axis range (rounded to nice ticks). |
| `grid` | Grid lines. Default true. |
| `legend` | `true`, `false`, "bottom" or "right"; by default shown when there are several series. Items toggle series. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed bar (`{ x, y, series, datum, values }`). |
| `title` / `description` | Accessible name (SVG title, table caption) and longer description. |
| `xLabel` / `empty` / `colors` / `width` / `height` / `class` | Table x header, no-data content, per-series colors, size (default: container width × 260). |

## Motion

Bars grow from the baseline when first drawn, glide to new values when the data changes and sink back to the
baseline before a removed category or hidden series disappears; value labels ride on the bar ends. `animate`: `true`
(default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` (stagger runs
category by category) or `({ index, key, phase }) => …`. On the engine clock: global speed, pause and reduced motion apply.

## Accessibility

- The SVG has a title and description; a visually hidden data table carries every value for screen readers.
- Tab reaches the plot; ← → move between bars, Home / End jump to the ends, Enter selects; the tooltip follows the
  keyboard bar.
- With reduced motion the bars move to new values in place. Legend items are toggle buttons with `aria-pressed`.
