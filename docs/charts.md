# Charts

`march/charts` is a separate module of SVG charts built on March signals. It is never imported by the core, so apps that do not use charts do not pay for them.

- **Reactive and fine-grained.** Marks are keyed lists; every SVG attribute is bound through a computed value. When data changes, only the elements whose geometry really changed are written (a series whose shape did not change keeps its `<path>` untouched).
- **CSP safe.** No inline style strings, no `innerHTML`. Colors come from classes and CSS custom properties; positions are SVG attributes (`x`, `y`, `d`, `transform`). The tooltip is placed with the CSSOM (`el.style.setProperty`), which a strict `style-src` allows.
- **Accessible.** `role="img"` with `<title>`/`<desc>` (via `aria-labelledby`), keyboard navigation between points, a live tooltip, legend toggles that are real buttons, and a visually hidden data table with the same data.
- **Responsive.** Width follows the container (`viewBox` + `ResizeObserver` when available); tick counts shrink on narrow widths.
- **Fast with large data.** Line and area charts downsample with LTTB above about 2 × the plot width.

```jsx
import { LineChart, BarChart, PieChart, Stat } from "march/charts";

let $sales = await api.sales();

<LineChart data={$sales} x="day" y={["income", "expense"]} format={["money", "USD"]} xFormat="date" title="Sales" />
```

Load the stylesheet once: `src/charts/charts.css` (copy it, link it, or import it through your bundler).

## Components

| Component | Use |
| --- | --- |
| `LineChart` | One or more series over time, numbers or categories. |
| `AreaChart` | Like `LineChart` with filled areas; `stacked` stacks series. |
| `BarChart` | Categories × series; grouped (default) or `stacked`; vertical or `horizontal`. |
| `PieChart` | Shares of a whole; `donut` for a ring with the total in the middle. |
| `Sparkline` | Tiny trend line without axes (in tables, KPI boxes, text). |
| `Stat` | KPI box: label, value, delta with arrow and sign, optional sparkline. |
| `Heatmap` | x × y grid (weekday × hour), or a daily `calendar` (e.g. last 12 weeks). |
| `ProgressRing` | Score ring 0–100. |
| `BarList` | Ranked horizontal bars with labels ("top N" lists). |

Helpers: `scaleLinear`, `scaleTime`, `scaleBand`, `niceTicks`, `niceStep`, `timeTicks`, `lttb`, `pieLayout`, `arcPath`, `heatLevel`.

## Common props

Every prop may be a plain value, a signal, or (from JSX) a live expression.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `data` | `array` \| signal \| `() => array` | `[]` | Array of objects (or numbers for `Sparkline`). |
| `x` | key \| `(row, i) => value` | index | Category / time / number. Scale is detected: `Date`, timestamps and ISO date strings → time; numbers → linear; anything else → categories. Force with `xType="time" \| "linear" \| "band"`. |
| `y` | key \| keys[] \| fn \| fn[] | `"y"` | One series per entry. A function series can carry a `key` property. |
| `series` | `string[]` \| `{ [key]: label }` \| `string` | keys | Labels for legend, tooltip and table. |
| `width` | number | container | Explicit width in px. Without it the chart is responsive (`width="100%"` + `viewBox`, resized by `ResizeObserver`). |
| `height` | number | 240 (bar 260) | Height in px (viewBox units). |
| `title` | string | `"Chart"` | Rendered as SVG `<title>` and table caption. |
| `description` | string | — | Rendered as SVG `<desc>`. Both are referenced by `aria-labelledby`. |
| `format` | pipe \| `[pipe, ...args]` \| fn | `"number"` | Value format for axis, tooltip and table: `"number"`, `["money", "USD"]`, `"percent"`, `"compact"`, `(v) => …`. Uses the active locale. |
| `xFormat` | pipe \| `[pipe, ...args]` \| fn | auto | x labels, e.g. `"date"`, `["date", "short"]`. Time axes pick a format from the visible span. |
| `colors` | `string[]` | palette | Per-series color override (set as the `--m-c` custom property through CSSOM). |
| `legend` | `true` \| `false` \| `"bottom"` \| `"right"` | shown when > 1 series | Legend items are toggle buttons that hide/show a series. |
| `grid` | `true` \| `false` \| `"both"` | `true` | Horizontal grid lines (`"both"` adds vertical ones). |
| `tooltip` | `true` \| `false` \| `(point) => node` | `true` | Custom content receives the point object. |
| `empty` | string | `"No data"` | Shown when there is no data. |
| `onSelect` | `(point) => void` | — | Click on a point/bar/slice/cell, or Enter/Space on the focused one. |
| `class` | string | — | Extra class on the wrapper. |

The **point** object passed to `onSelect` and `tooltip`: `{ index, datum, x, label, values: { [seriesKey]: number }, series, y }` (pie adds `share`, heatmap gives `{ x, y, value, label }`).

### LineChart / AreaChart

| Prop | Default | Notes |
| --- | --- | --- |
| `stacked` (area) | `false` | Stack the visible series. |
| `zoom` | `false` | Drag across the plot to zoom into an x range; double click, Escape or the "Reset zoom" button resets. |
| `maxPoints` | `2 × plot width` | LTTB threshold per series. |
| `zero` | `false` (area: always) | Include 0 in the y domain. |
| `yMin`, `yMax` | data | Fix the y domain (still rounded to nice ticks). |
| `xLabel` | x key | Header of the x column in the data table. |

Missing values (`null`, `""`, `NaN`) break the line into segments.

```jsx
<LineChart data={$metrics} x="time" y={["p50", "p95"]} series={{ p50: "Median", p95: "95th percentile" }}
  format={(ms) => `${ms} ms`} zoom maxPoints={800} title="Latency" />
<AreaChart data={$traffic} x="day" y={["mobile", "desktop"]} stacked format="compact" title="Visitors" />
```

### BarChart

| Prop | Default | Notes |
| --- | --- | --- |
| `stacked` | `false` | Stack series in one bar (negative values stack downwards). |
| `horizontal` (or `orientation="horizontal"`) | `false` | Categories on the y axis. |
| `yMin`, `yMax` | data | Value domain. |
| `animate` | off | On a data change the bars glide to their new size (`true`: a spring, or an easing name such as `"spring-wobbly"`); the axes take the new scale at once. Off with reduced motion. |

Categories should be unique (bars are keyed by `category|series`).

```jsx
<BarChart data={$orders} x="month" y={["online", "store"]} stacked format={["money", "EUR"]} title="Orders" />
<BarChart data={$countries} x="name" y="users" horizontal height={320} title="Users by country" />
```

### PieChart

| Prop | Default | Notes |
| --- | --- | --- |
| `x` | `"label"` | Slice label. |
| `y` | `"value"` | Slice value (negative values count as 0). |
| `donut` | `false` | `true` (inner radius 60 %) or a ratio `0..0.95`. |
| `animate` | off | On a data change the slices turn to their new angles and a new slice opens from its edge (`true`: a spring, or an easing name such as `"spring-wobbly"`). Off with reduced motion. |
| `center` | formatted total | Text in the donut hole. |
| `padAngle` | `0.01` | Gap between slices (radians). |

```jsx
<PieChart data={$plans} x="plan" y="customers" donut center="Plans" legend="right" title="Customers by plan" />
```

### Sparkline

Props: `data` (numbers or objects), `y`, `width` (120), `height` (32), `area`, `dot` (last point, default on), `zero`, `color` (palette index), `format`, `title`. Its `aria-label` summarizes the series (count, first, last, min, max).

```jsx
<Sparkline data={$visits} y="count" area />
```

### Stat

| Prop | Notes |
| --- | --- |
| `label`, `value` | Value formatted with `format`. |
| `delta` | Change as a fraction (`0.12` → `+12%`). |
| `previous` | Computes `delta = (value − previous) / |previous|` when `delta` is not given. |
| `deltaFormat` | Format of `|delta|`, default `["percent", 1]`. |
| `invert` | A decrease is good (costs, latency). |
| `hint` | Text after the delta, e.g. "vs last week". |
| `spark`, `sparkY` | Data for an inline sparkline. |

Classes: `m-stat-up|down|flat` and `m-stat-good|bad|neutral`. The arrow is `aria-hidden`; screen readers hear "Up" / "Down".

```jsx
<Stat label="Revenue" value={$revenue} previous={$lastMonth} format={["money", "USD"]} hint="vs last month" spark={$daily} />
```

### Heatmap

| Prop | Default | Notes |
| --- | --- | --- |
| `x`, `y`, `value` | `"x"`, `"y"`, `"value"` | Cell keys; duplicates are summed. |
| `xDomain`, `yDomain` | data order | Order (and completeness) of columns / rows. |
| `xFormat`, `yFormat` | `String` | Axis labels. |
| `levels` | 5 | Color levels `m-heat-0..4` (0 = empty or ≤ 0). |
| `animate` | off | On a value change the cells fade to their new color (`true`: a spring, or an easing name such as `"out"`); a CSS transition. Off with reduced motion. |
| `max` | data max | Value of the top level. |
| `cell` | fits the width (≤ 32) | Fixed cell size in px. |
| `calendar` | — | `true` or `{ weeks: 12 }`: `x` is a date; columns are weeks, rows Monday…Sunday. |
| `end` | latest date | Last day of the calendar. |
| `valueLabel` | `"Value"` | Tooltip row label. |

Arrow keys move between cells (Up/Down change rows).

```jsx
<Heatmap data={$visits} x="hour" y="weekday" value="count" yFormat={(d) => days[d]} title="Busy hours" />
<Heatmap data={$commits} x="date" value="count" calendar={{ weeks: 12 }} title="Activity" />
```

### ProgressRing

Props: `value` (0–`max`), `max` (100), `size` (64), `thickness` (8), `label` (for `aria-label`, default "Score"), `format`, `thresholds` (`[50, 80]` → classes `m-ring-low|mid|high`).

```jsx
<ProgressRing value={$score} label="Profile completeness" />
```

### BarList

Props: `data`, `x` (`"label"`), `y` (`"value"`), `format`, `limit` (top N), `sort` (default descending; `false` keeps order), `max` (scale), `color`, `colors`, `title` (list label), `empty`, `onSelect(item)` (rows become buttons; `item` has `label`, `value`, `datum`, `rank`). Bars are SVG rects with percentage widths, so no inline styles are needed.

```jsx
<BarList data={$pages} x="path" y="views" limit={5} format="compact" title="Top pages" />
```

## Keyboard and screen readers

- The chart `svg` is focusable (`tabindex="0"`). **Left/Right** (and Up/Down) move between points, bars or slices; **Home/End** jump to the first/last; **PageUp/PageDown** move by 10 %; **Enter/Space** call `onSelect`; **Escape** hides the tooltip (and resets zoom).
- The tooltip is a `role="status"` live region, so values are announced while navigating.
- Each chart renders a visually hidden `<table class="m-sr-only">` with a caption (the title), a header row (x label + series labels) and the formatted values. Up to 1000 rows are rendered; the caption says when it is truncated.
- Legend items are `<button aria-pressed>`; hidden series get `m-chart-off`.
- Every mark color has a non-color companion: the legend label, the tooltip label and the table.

## Theming

All colors are custom properties on `:root`; override them globally or on any wrapper:

| Token | Use |
| --- | --- |
| `--m-chart-1` … `--m-chart-8` | Series palette (Okabe–Ito based, colorblind friendly). |
| `--m-chart-text`, `--m-chart-muted` | Text, tick labels. |
| `--m-chart-axis`, `--m-chart-grid` | Axis lines, grid lines. |
| `--m-chart-bg` | Background used for slice borders and markers. |
| `--m-chart-tooltip-bg`, `--m-chart-tooltip-text` | Tooltip. |
| `--m-chart-focus`, `--m-chart-brush` | Active mark outline, zoom selection. |
| `--m-chart-good`, `--m-chart-bad` | Stat deltas, ring levels. |
| `--m-heat-0` … `--m-heat-4` | Heatmap levels. |
| `--m-ring-low|mid|high` | Progress ring levels. |
| `--m-chart-font`, `--m-chart-font-size` | Typography. |

Dark values apply with `:root[data-theme="dark"]`, or automatically under `prefers-color-scheme: dark` unless `:root[data-theme="light"]` is set.

Series classes are `m-chart-series-0` … `m-chart-series-7` (they set `--m-c`). Marks: `m-chart-line`, `m-chart-area`, `m-chart-bar`, `m-chart-slice`, `m-heat-cell`, `m-chart-marker`. Wrappers: `m-chart` plus `m-line-chart`, `m-area-chart`, `m-bar-chart`, `m-pie-chart`, `m-heatmap-chart`.

```css
.revenue { --m-chart-1: #7c3aed; --m-chart-2: #f59e0b; }
```

## Performance

- Geometry is computed once per change in a computed value; attributes are bound through computeds, so unchanged paths, bars, ticks and cells are not written.
- `lttb(points, threshold, getX?, getY?)` (Largest-Triangle-Three-Buckets) keeps the first and last points and the visual shape. Line and area charts apply it per series when the visible range has more than `maxPoints` points (default 2 × plot width); zooming re-samples the zoomed range at full detail.
- Pointer lookup uses binary search on sorted x values.
- `node bench/charts.js` renders a two-series `LineChart` with 10,000 and 100,000 points in the test DOM and prints render and update times.

## Scales

```js
import { scaleLinear, scaleTime, scaleBand, niceTicks } from "march/charts";

niceTicks(0, 97, 5);             // { min: 0, max: 100, step: 20, ticks: [0, 20, 40, 60, 80, 100] }
const y = scaleLinear([0, 100], [200, 0]);
y(25); y.invert(150); y.ticks(5); y.nice(5);
const t = scaleTime([start, end], [0, 600]);
t(new Date()); t.ticks(6);      // epoch ms on day / week / month / year boundaries
const b = scaleBand(["a", "b", "c"], [0, 300], { paddingInner: 0.2, paddingOuter: 0.1 });
b("b"); b.bandwidth; b.center("b"); b.invert(140);
```
