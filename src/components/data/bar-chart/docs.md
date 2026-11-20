# BarChart

Bars from rows of objects: one series, several side by side (grouped) or on top of each other (`stacked`), standing up
or lying down (`horizontal`). Data may be a signal or a function; with `animate` the bars glide to new values while the
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
| `animate` | On a data change the bars glide: `true` (a spring) or an easing name ("out", "spring-wobbly"…). Default off. |
| `xFormat` / `format` | Formats of the category labels and of the values: a pipe name, `[pipe, ...args]` or a function. |
| `yMin` / `yMax` | The value axis range (rounded to nice ticks). |
| `grid` | Grid lines. Default true. |
| `legend` | `true`, `false`, "bottom" or "right"; by default shown when there are several series. Items toggle series. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed bar (`{ x, y, series, datum, values }`). |
| `title` / `description` | Accessible name (SVG title, table caption) and longer description. |
| `xLabel` / `empty` / `colors` / `width` / `height` / `class` | Table x header, no-data content, per-series colors, size (default: container width × 260). |

## Accessibility

- The SVG has a title and description; a visually hidden data table carries every value for screen readers.
- Tab reaches the plot; ← → move between bars, Home / End jump to the ends, Enter selects; the tooltip follows the
  keyboard bar.
- With reduced motion the bars move to new values in place. Legend items are toggle buttons with `aria-pressed`.
