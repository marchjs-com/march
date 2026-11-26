# Altimeter

An aircraft's three-pointer altimeter: the long hand counts hundreds (one turn per 1,000), the short wide hand
thousands (one turn per 10,000), the thin pointer with a wedge tip ten thousands, all on one 0–9 dial, and a pressure
(Kollsman) window at 3 o'clock whose digits roll. For flight simulators, drone telemetry, hiking and elevation
dashboards, a game cockpit. The hands move on springs and spin through big climbs like the real instrument.

```tsx
<Altimeter value={$altitude} pressure={1013} />
<Altimeter value={$alt} unit="m" pressure={29.92} pressureUnit="inHg" />
<Altimeter value={$alt} parts={{ tenThousands: false, window: false }} hands={{ hundreds: { color: "warning" } }} />
```

## Design: why it composes Gauge

A three-pointer altimeter is one dial with three needles turning at three speeds. Gauge draws that with a wrapping
0–1000 scale: values are not clamped, so 12,500 ft puts the long hand half a turn past twelve whole turns, and a climb
of 5,000 ft spins it five times on the spring. The three hands are Gauge `needles` of three shapes (`length`, `width`,
`tip`, `tail`); the pressure window sits in Gauge's `readout` slot and rolls on CountRoll. Altimeter adds the hand
ratios (÷1, ÷10, ÷100), the window and the spoken altitude.

## Props

| Prop | |
|---|---|
| `value` | The altitude, in `unit` (it may be live). Required. |
| `unit` | Printed on the dial and spoken. Default "ft". |
| `pressure` / `pressureUnit` | The pressure setting in the window, `"hPa"` (default, whole numbers) or `"inHg"` (two decimals); `null`: no window. |
| `caption` | Text on the dial. Default "ALT · ft"; `false`: none. |
| `hands` | Each hand's look: `{ hundreds, thousands, tenThousands }` with `length`, `width`, `tip`, `tail`, `color`, `class`. |
| `color` | Theme color token of the ten-thousands pointer. Default `"warning"`. |
| `size` | Width in px. Default 220. |
| `parts` | `face`, `ticks`, `labels`, `caption`, `hundreds`, `thousands`, `tenThousands`, `window`, `hub`, `glass`. |
| `motion` | `false`: the hands stand on the altitude at once; reduced motion does the same. |
| `label` | Accessible name. Default "Altimeter". |

Class hooks: `m-alt`, `m-alt-100`, `m-alt-1k`, `m-alt-10k`, `m-alt-window`, `m-alt-pressure`, `m-alt-punit`, and the
Gauge hooks inside.

## Accessibility

- A `role="img"` named "Altimeter: 12,500 ft, 1013 hPa", updated at most 4 times a second (Gauge's `throttled`); the
  dial itself is hidden from screen readers, so three hands never read as three numbers.
- The hands and the window digits move on the motion engine; reduced motion (or `motion={false}`) puts them on the
  value at once.

## Composed of

Gauge, CountRoll.
