# ProgressRing

A score ring with the number in the middle: a health score, a goal, a sleep score. `value` runs from 0 to `max`
(default 100); the ring takes the low / mid / high level color from `thresholds` (percent limits, default 50 and 80),
or one theme `color`. With `colors` it carries several colors: the four HADİ colors ("brand", the HADİ theme's default)
or your own list, as a gradient, equal segments or flowing around the ring.

```tsx
<ProgressRing value={$sleep} label="Sleep score" />
<ProgressRing value={7} max={10} size={88} thickness={10} color="brand-blue" format={(v) => `${v}/10`} />
<ProgressRing value={64} colors="brand" paint="segments" label="Week" />
```

## Props

| Prop | |
|---|---|
| `value` | The score (it may be live), clamped to 0…max. |
| `max` | The full score. Default 100. |
| `size` / `thickness` | Diameter and ring thickness in px. Default 64 and 8. |
| `thresholds` | Percent limits of the low / mid / high levels. Default `[50, 80]`. |
| `color` | One theme color token for the ring. Default: the level color. |
| `colors` | Several colors: "brand", a list of color tokens, or "single" (one color even in a multicolor theme). |
| `paint` | How several colors are laid out: "gradient" (default), "segments" or "cycle" (they flow). |
| `format` | Format of the number in the middle. Default: rounded. |
| `label` | Accessible name. Default "Score". |

## Accessibility

- The ring is an image (`role="img"`) named "<label>: <value> of <max>"; the number in the middle is hidden from screen
  readers so it is not read twice.
- The level is told by the number, not only by the color. A flowing ring stops with reduced motion.
