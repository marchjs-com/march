# Histogram

How values spread: give the raw values, the chart bins them. Bins sit on nice thresholds (about `bins` of them) or a
fixed `binWidth`; bars touch on a linear x axis. `cumulative` runs the totals up, `density` normalizes (the bars' area
is 1), `curve` lays a fitted normal curve or a kernel density estimate over the bars, and `group` overlays several
distributions in translucent colors on the same bins.

```tsx
<Histogram data={$times} bins={20} curve="kde" marks={[{ x: "median" }, { x: 30, label: "Hedef" }]}
  xFormat={(v) => `${v} dk`} title="Teslimat süreleri" />
<Histogram data={people} value="age" group="city" binWidth={5} density animate={{ stagger: 20 }} />
```

## Props

| Prop | |
|---|---|
| `data` | Raw values: numbers, or rows read with `value` (an array, a signal or a function returning one). |
| `value` | The value of a row: a key or getter. Default: the row itself when it is a number, else "value". |
| `group` / `groupLabels` | Overlaid groups (shared bins, legend toggles) and `{ value: label }` names for them. |
| `bins` | About how many bins (rounded to nice thresholds). Default: Sturges' rule. |
| `binWidth` | An exact bin width (wins over `bins`). |
| `domain` | The binned range `[min, max]`; values outside are left out. |
| `cumulative` | Running totals. |
| `density` | Normalized heights (area 1); with `cumulative`, shares from 0 to 1. |
| `curve` / `bandwidth` | "normal", "kde" (or `true`) or `false`; the kernel's bandwidth (default Silverman's rule). |
| `marks` | Reference marks; `{ x: "average" }`, `"median"`, `"min"`, `"max"` (with `series`) draw a group's statistic. |
| `xFormat` / `format` | Formats of the bin edges and of the heights. |
| `yMax` / `grid` / `gap` | Top of the value axis, horizontal grid (default on), the gap between bars (default 1 px). |
| `xTitle` / `yTitle` | Axis titles. |
| `xLabel` / `yLabel` | Table / tooltip names of the range and the value ("Range", "Count" / "Density" / "Share"). |
| `animate` | `true` (spring, default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed bin (`{ x0, x1, label, count, value, counts, values }`). |
| `legend` | `true`, `false`, "bottom" or "right"; shown with two or more groups. |
| `title` / `description` / `empty` / `colors` / `width` / `height` / `class` / `export` | As on every chart (default height 260). |

`binsOf(values, { count, width, domain })` and `countBins(values, bins)` give the bins for your own drawing.

## Accessibility

- The SVG has a title and description; a visually hidden table lists every bin with its range and value per group.
- Tab reaches the plot; ← → move between bins, Home / End jump to the ends, Enter selects, Escape clears. The band
  behind the bin and the tooltip follow the keyboard.
- Legend items are toggle buttons with `aria-pressed`.

## Motion

Bars grow from the baseline (with `stagger`, left to right). Bars are keyed by their bin number, so a re-bin (new
`bins`, `binWidth`, data or `cumulative`) morphs every bar's x, width and height; bins that are no longer there shrink
back to the baseline before they go. The curve rises from the baseline and morphs with the data. Reduced motion: the
bars take their new shape at once.
