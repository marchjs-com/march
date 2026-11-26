# Sparkline

A tiny trend line without axes: in a table cell, a list row or a KPI box (Stat uses it). `data` is a list of numbers, or
objects read through `y`; it may be a signal or a function and the line follows it. Long series are downsampled (LTTB).
`variant="bar"` draws tiny columns from the zero line; `variant="winloss"` draws an up block for every positive value,
a down block for every negative one (good / bad colors) and a neutral tick for 0: a team's form, passed / failed builds.

```tsx
<Sparkline data={$prices} area />
<Sparkline data={rows} y="visits" width={160} height={40} color={2} dot={false} title="Visits" />
<Sparkline data={latency} zero format={(v) => `${v} ms`} title="Latency" />
<Sparkline data={sales} variant="bar" animate={{ stagger: 30 }} />
<Sparkline data={[1, -1, 1, 1, 0, -1]} variant="winloss" title="Last games" />
```

## Props

| Prop | |
|---|---|
| `data` | Numbers, or objects read through `y`: an array, a signal or a function. |
| `y` | The value of an object row: a key or getter. |
| `variant` | "line" (default), "bar" (columns) or "winloss" (up / down blocks, a tick for 0). |
| `width` / `height` | Size in px. Default 120 × 32. |
| `area` | Fills under the line. |
| `dot` | The marker on the last point of a line. Default true. |
| `zero` | Includes 0 in the value range (bars always do). |
| `color` / `colors` | Palette slot (0-based) or colors overriding the palette. |
| `format` | Value format used in the accessible summary. |
| `title` | Accessible name, read before the summary. |
| `empty` | Accessible text when there is no data. Default "No data". |
| `animate` | Change animation: `true` (default, a spring), `false`, an easing name or `{ duration, easing, stagger, delay, enter, update, exit }`. |

## Accessibility

- The line is an image (`role="img"`); its name is the title and a summary: how many values, first and last, minimum
  and maximum, formatted with `format`; a win / loss strip says "7 wins, 3 losses" (and the ties).
- There is nothing to focus; put the numbers next to the line (or in a table) when they matter.

## Motion

- The line rises from its baseline when first drawn and morphs to new data on the motion engine. When one value is
  appended the new point grows out of the last one; when the window moves on (first value dropped, one appended) the
  line slides left. The area follows the line and the last dot glides with it.
- Columns and win / loss blocks grow out of the zero (middle) line, one after another with `stagger`; on new data they
  grow or flip to their new size, and blocks that leave shrink back into the line before they are removed.
- `animate={false}` draws at once; reduced motion jumps; global speed and pause reach every tween.
