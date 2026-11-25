# Odometer

A counter drawn on number drums: a car's mileage counter, a water or power meter, a visitor counter, a flip clock.
It is CountRoll (the one rolling number) inside a drum frame: `digits` integer drums with leading zeros (past the
last one it rolls over, 999999 → 000000), `decimals` fraction drums (the classic red drum), a `unit`, and three looks.
Only the drums whose digit changed roll, upward when the value grows and downward when it shrinks, on the motion engine.

```tsx
<Odometer value={$km} digits={6} decimals={1} unit="km" />
<Odometer value={$visitors} digits={7} variant="flip" size="lg" />
<Odometer value={$kwh} decimals={2} unit="kWh" variant="digital" color="success" />
<Odometer value={$n} frame={false} motion={false} />
```

## Props

| Prop | |
|---|---|
| `value` | The number (it may be live). The sign is drawn before the drums, not on one. |
| `digits` | Integer drums (zero-padded, rolls over past them). Default 6. |
| `decimals` | Fraction drums after the decimal mark (red on a mechanical counter). Default 0. They show the passed fraction (truncated, never rounded up). |
| `unit` | Text or a node after the drums; `false`: none. |
| `variant` | `"mechanical"` (default: metal drums), `"digital"` (a lit display), `"flip"` (flip clock cards). |
| `size` | `"sm"`, `"md"` (default), `"lg"` or the drum height in px. |
| `color` | Theme color token of the lit digits (digital). Default: the accent. |
| `frame` | The bezel around the drums. Default true. |
| `motion` | `false` swaps digits at once. Reduced motion does the same. |
| `duration` / `stagger` | Roll time of a drum (default 600 / 260 / 420 ms by look) and the delay between drums (40 ms). |
| `label` | Accessible name. Default "Odometer". |
| `spoken` | Your own screen-reader text for a value. Default: the number in the locale plus the unit. |
| `class` | Extra class on the root. |

Class hooks: `m-odo` (root, plus `m-odo-mechanical|digital|flip`), `m-odo-drums` (the frame), `m-odo-roll` (the
CountRoll), `m-odo-unit`, `m-odo-sign`. CSS variables: `--m-odo-h` (drum height), `--m-odo-w`, `--m-odo-gap`,
`--m-odo-drum`, `--m-odo-ink`, `--m-odo-frac`, `--m-odo-lit`.

## Accessibility

- The counter is an image (`role="img"`) named "<label>: <value> <unit>" in the locale (`Odometer: 12,345.6 km`); the
  drums and the unit are not read one by one.
- With reduced motion (or `motion={false}`) the digits change without rolling.
