# RadialBarChart

Progress of a few things side by side as concentric rings: every row is a ring (the first is the outermost), its bar
sweeps from the start angle by its share of the max. By default the rings fill three quarters of a circle and their
labels sit in the free quarter; `endAngle={360}` makes full circles, `startAngle={-135} endAngle={135}` a gauge-like
arc. The middle shows the value of the ring under the pointer or keyboard (the first ring otherwise).

```tsx
<RadialBarChart data={$rings} x="label" y="value" rowMax="goal" title="Activity" />
<RadialBarChart data={langs} max={100} endAngle={360} innerRadius={0.4} format="percent" legend="right" />
<RadialBarChart data={stats} startAngle={-135} endAngle={135} rounded={false} center={(p) => p.label} />
```

## Props

| Prop | |
|---|---|
| `data` | Rows, one ring each: an array, a signal or a function returning one. |
| `x` | The ring label: a key or getter. Default "label". |
| `y` | The ring value: a key or getter. Default "value"; negative values count as 0. |
| `max` | The value of a full sweep for every ring. Default the largest value. |
| `rowMax` | A ring's own full-sweep value from its row (a key or getter); wins over `max`. |
| `startAngle` / `endAngle` | Degrees clockwise from 12 o'clock. Default 0 and 270. |
| `innerRadius` | The hole in the middle as a share of the radius 0…0.9. Default 0.3. |
| `gap` | Space between rings as a share of a ring's band 0…0.9. Default 0.28. |
| `rounded` | Round bar ends. Default true. |
| `track` | The faint full ring behind every bar. Default true. |
| `labels` | Ring labels at the ring starts. Default true. |
| `center` | The middle: default the active ring's value and label; any value, `(point) => content`, or `false`. |
| `format` | Value format: a pipe name, `[pipe, ...args]` or a function. |
| `xLabel` / `yLabel` | Headers of the data table. Defaults "Label" and "Value". |
| `tooltip` | `true` (default), `false` or `(point) => content`. Point: `{ index, label, value, max, share, datum }`. |
| `onSelect` | Called with the ring's point on click or Enter / Space. |
| `animate` | `true` (default spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `legend` | `true`, "bottom" or "right": one toggle per ring (off by default: the rings carry labels). |
| `title` / `description` / `empty` / `colors` / `width` / `height` / `class` / `export` | Accessible name and description, no-data content, per-ring colors, size, extra class, export buttons. |

Class hooks: `m-radial-ring`, `m-radial-track`, `m-radial-bar`, `m-radial-label`, `m-radial-center`,
`m-radial-center-value`, `m-radial-center-label`; `--m-radial-track` colors the tracks.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists every ring with its value and max.
- Tab reaches the chart; arrows (Home, End) move from ring to ring, Enter / Space selects, Escape clears. The
  keyboard ring stays bright while the others dim, the middle and the tooltip show its value.
- Legend items (when shown) are toggle buttons with `aria-pressed`.

## Motion

- Enter: every ring sweeps from its start to its value (`stagger` delays ring after ring, outside in).
- Update: on new values the sweeps morph; when rings come or go the others glide to their new radius and thickness.
- Exit: a ring that leaves (data or legend) unwinds back to its start before it is removed.
- `animate={false}` or reduced motion: rings take their sweeps at once.
