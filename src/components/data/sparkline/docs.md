# Sparkline

A tiny trend line without axes: in a table cell, a list row or a KPI box (Stat uses it). `data` is a list of numbers, or
objects read through `y`; it may be a signal or a function and the line follows it. Long series are downsampled (LTTB).

```tsx
<Sparkline data={$prices} area />
<Sparkline data={rows} y="visits" width={160} height={40} color={2} dot={false} title="Visits" />
<Sparkline data={latency} zero format={(v) => `${v} ms`} title="Latency" />
```

## Props

| Prop | |
|---|---|
| `data` | Numbers, or objects read through `y`: an array, a signal or a function. |
| `y` | The value of an object row: a key or getter. |
| `width` / `height` | Size in px. Default 120 × 32. |
| `area` | Fills under the line. |
| `dot` | The marker on the last point. Default true. |
| `zero` | Includes 0 in the value range. |
| `color` / `colors` | Palette slot (0-based) or colors overriding the palette. |
| `format` | Value format used in the accessible summary. |
| `title` | Accessible name, read before the summary. |
| `empty` | Accessible text when there is no data. Default "No data". |

## Accessibility

- The line is an image (`role="img"`); its name is the title and a summary: how many values, first and last, minimum
  and maximum, formatted with `format`.
- There is nothing to focus; put the numbers next to the line (or in a table) when they matter.
