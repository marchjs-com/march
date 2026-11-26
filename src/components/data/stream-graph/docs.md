# StreamGraph

Categories over time as flowing layers around a moving centre line: topics in the news, genres in a playlist, sources
of traffic. Built on AreaChart's engine with a stream baseline, smooth curves and no value axis (the shape is the
message; exact values are in the tooltip and the data table).

```tsx
<StreamGraph data={$weeks} x="week" y={["pop", "rock", "jazz", "rap"]} title="What we listened to" />
<StreamGraph data={$days} x="day" y={["search", "social", "mail"]} offset="silhouette" edges legend="right" />
<StreamGraph data={$share} x="month" y={["a", "b", "c"]} offset="expand" curve="step" animate={{ stagger: 80 }} />
```

## Props

Every AreaChart prop (data, x, y, series, xType, xFormat, format, grid, curve, markers, marks, window, navigator, sync,
zoom, legend, tooltip, onSelect, export, colors, title, description…), with these defaults and additions:

| Prop | |
|---|---|
| `offset` | Baseline of the stream: "wiggle" (default, least shear between layers), "silhouette" (centred) or "expand" (shares of 100 %). |
| `edges` | Draw each layer's edge line (default false: soft layers only). |
| `curve` | Default "smooth". |
| `grid` | Default "x" (vertical lines for time). |
| `legend` | Default "bottom"; items toggle layers. |
| `animate` | Change animations (see Motion). Default on. |

## Motion

The layers rise from the centre as a wave from left to right; when the data changes every layer swells or thins in
place; a layer hidden in the legend closes up and the others flow together; live data (`window`) slides. `animate`:
`true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` (stagger
per layer) or `({ index, key, phase }) => …`. On the engine clock: global speed, pause and reduced motion apply.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists every value.
- Tab reaches the plot; ← → move between points, Enter selects; the tooltip lists every layer at that x.
- Legend items are toggle buttons with `aria-pressed`. Hovering a layer fades the others.
