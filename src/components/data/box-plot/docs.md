# BoxPlot

The spread of values per category. Give the raw values (one row per value, or one row per category with a list); the
chart works out the quartiles, the whiskers (1.5 × IQR, another multiple, or min / max), the outliers and the mean.
`mode="violin"` draws a kernel density silhouette instead, `"both"` keeps a slim box inside it, and `showPoints`
scatters every raw value beside the box with a deterministic jitter.

```tsx
<BoxPlot data={$waits} x="day" y="minutes" mode="both" showPoints format={(v) => `${v} dk`} title="Bekleme süreleri" />
<BoxPlot data={teams} horizontal whisker="minmax" marks={[{ y: 40, label: "Hedef" }]} />
```

## Props

| Prop | |
|---|---|
| `data` | Rows: `{ label, value }` per value or `{ label, value: [..] }` per category (array, signal or function). |
| `x` / `y` | The category and the value (or list of values): keys or getters. Default "label" and "value". |
| `mode` | "box" (default), "violin" or "both". |
| `whisker` | "iqr" (default, 1.5 × IQR), "minmax" or an IQR multiple. |
| `outliers` / `mean` | Outlier dots and the mean diamond (both default on). |
| `showPoints` / `jitter` | Every raw value as a dot; the jitter width as a share of the box (default 0.7). |
| `horizontal` | Categories on the y axis. |
| `bandwidth` / `boxWidth` | Violin kernel bandwidth (default Silverman per category); box width as a share of the band (default 0.6). |
| `format` / `xFormat` | Value format; category label format. |
| `yMin` / `yMax` / `grid` / `yTitle` | Value axis ends, grid lines (default on), the value axis title. |
| `marks` | Value lines and bands across the categories (`{ y: 40 }`, `{ y: [30, 50] }`, `{ y: "median" }`). |
| `xLabel` | Table header of the category column (default "Category"). |
| `animate` | `true` (spring, default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `tooltip` | `true` (default: count, min, quartiles, max, mean, outliers), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed category (`{ label, stats, values }`). |
| `legend` | Off by default (the axis names the categories); `true`, "bottom" or "right" shows toggles. |
| `title` / `description` / `empty` / `colors` / `width` / `height` / `class` / `export` | As on every chart (default height 280). |

`boxStats(values, k)` gives the summary for your own drawing.

## Accessibility

- The SVG has a title and description; a visually hidden table lists count, min, quartiles, max and mean per category.
- Tab reaches the plot; ← → move between categories, Home / End jump to the ends, Enter selects, Escape clears; the
  tooltip follows the keyboard category.
- The median is a strong line and the mean a hollow diamond, so they read without color.

## Motion

A box (and its violin) grows out of its median: the quartiles, whiskers and silhouette open up, raw points fly out
from the median to their places. On a data change every part morphs to the new numbers; categories that leave (or are
hidden from the legend) collapse back into their median before they go, and the others slide to their new bands.
Reduced motion: shapes take their new place at once.
