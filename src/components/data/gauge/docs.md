# Gauge

A dial with a needle, as on a car's instrument cluster, a fine watch or a studio VU meter: server load, download
speed, a speed, engine revs, a loudness. The arc carries a track, coloured `zones` and a `redline`; major and minor
ticks carry labels; the needle moves on spring physics on the motion engine (or with VU ballistics); a peak mark keeps
the highest value; the readout under the hub is a rolling number (CountRoll) or number drums (Odometer).

```tsx
<Gauge value={$speed} max={240} unit="km/h" label="Speed" />
<Gauge variant="tachometer" value={$rpm} />                               // 0–8000, ×1000 labels, redline at 6500
<Gauge variant="half" value={$load} unit="%" zones={[{ from: 0, to: 60, color: "success" }, { from: 60, to: 85, color: "warning" }]} redline={85} peak />
<Gauge variant="vu" source={audioSource("demo")} />                      // a needle VU meter in dB (march/audio)
<Gauge value={$mbps} max={1000} readout="odometer" needle="vu" color="brand-blue" />
<Gauge value={$now} needles={[{ value: $avg, label: "Average", color: "info", length: 0.7 }]} />   // several needles
<Gauge min={0} max={60} sweep={360} start={0} needles={hands} />          // a full circle that wraps (a clock face)
```

## Several needles, full circles, a turning scale, an inlay

These four features make Gauge the dial of the other instruments (AnalogClock, Stopwatch, Compass, Altimeter,
AttitudeIndicator) instead of each drawing its own dial:

- `needles`: more needles, each with its own `value`, `color`, `label`, `length`, `width`, `tip`, `tail`, `move` and
  `class`. Each one springs on its own; every needle is in the spoken value ("10 %, Average 80 %"), unless `silent`.
  The needles keep their nodes and their motion when you pass a new array, so an inline literal is fine. Without
  `value` only these needles are drawn.
- `sweep={360}` with `start` (where `min` sits, degrees from 12 o'clock) and `wrap` (on by default for a full
  circle): values are not clamped and go round, so 1250 on a 0–1000 dial is one turn and 250. A full circle draws one
  mark where the end meets the start. `unwrap(prev, next, span)` (exported) keeps a circular value continuous, so a
  needle takes the short way round.
- `turn`: the scale (track, zones, ticks, labels, peak mark) turns under fixed needles, with the needle's motion: a
  compass rose.
- `inlay`: your own drawing on the face, under the scale and the needles (sub-dials, a logo, an artificial horizon).

Every change of a value, a needle and `turn` animates on the motion engine; a change in the middle of a move retargets
from where the needle is; `motion={false}` or reduced motion jumps.

## Props

| Prop | |
|---|---|
| `value` | The value (it may be live), clamped to the scale. |
| `source` | An audio source (march/audio): `"mic"`, `"demo"`, an element, a stream, or a 0–1 accessor. The needle shows its loudness (dB on `vu`, 0 dB = level 0.5); the readout and the spoken value follow 4 times a second. It reads only while the gauge is on screen. |
| `min` / `max` | The scale. Default 0–100 (tachometer 0–8000, vu −20…+3 dB). |
| `variant` | `"speedometer"` (270°, default), `"tachometer"` (×1000 labels, redline), `"half"` (180°), `"vu"` (VU meter: voltage-linear dB scale, black needle, warm face). |
| `zones` | Coloured bands: `[{ from, to, color }]` with theme color tokens. |
| `redline` | Start of the red zone (red ticks and labels; past it the arc and the needle turn red and the face glows). `false`: none. Default: tachometer 81 % of the scale, vu 0 dB. |
| `peak` / `peakHold` | `true` holds the highest value seen (`onPeak` on a new one); a number marks that value. `peakHold` (ms) lets a held peak fall back. |
| `ticks` | `{ step, values, minor, labels }` or `false`. Default: a round step that ends on the scale's end, 4 minor ticks. `labels` may be a function. |
| `needle` | `"spring"` (default), `"vu"` (300 ms ballistics) or `"none"`. |
| `readout` | `true` (rolling number), `"odometer"`, your own node or `(value) => node`; `false`: none. Default true (vu: false). |
| `unit` / `format` | Unit under the readout and in the spoken value; format of the readout (a function or Intl.NumberFormat options). |
| `caption` | Text on the dial. Default: tachometer "×1000 r/min", vu "VU". |
| `size` / `sweep` | Width in px (default 220, half 240, vu 260) and the scale's angle (90–360°). |
| `color` | Theme color token of the needle and the value arc. Default: the accent. |
| `needles` | More needles: `[{ value, label, color, length, width, tip, tail, move, silent, class }]`. |
| `start` / `wrap` | Where `min` sits (degrees from 12 o'clock; default centred) and a circular scale that does not clamp (default on a 360° sweep). |
| `turn` | Degrees the scale turns under the needles (a compass rose); it moves as the needle does. |
| `inlay` | Your own node (or function) on the face, under the scale. |
| `parts` | Each part on or off: `face`, `track`, `arc`, `zones`, `ticks`, `labels`, `caption`, `needle`, `needles`, `hub`, `peak`, `readout`, `glass`, `inlay`. |
| `motion` | `false`: the needle stands on the value at once (reduced motion too). |
| `label` | Accessible name. Default "Gauge". |
| `onPeak` / `onRedline` | A new peak; the value entered (`true`) or left (`false`) the red zone. |

Class hooks: `m-gauge` (+ `m-gauge-<variant>`, `is-round` / `is-flat`, `is-redline`), `m-gauge-track`, `m-gauge-zone`,
`m-gauge-arc`, `m-gauge-tick` (`is-major`, `is-minor`, `is-red`), `m-gauge-label`, `m-gauge-caption`, `m-gauge-peak`,
`m-gauge-scale`, `m-gauge-needle` (`is-extra` for the `needles`), `m-gauge-needles`, `m-gauge-inlay`, `m-gauge-hub`, `m-gauge-readout`, `m-gauge-value`, `m-gauge-unit`, `m-gauge-glass`. CSS variables:
`--m-gauge-w`, `--m-gauge-needle`, `--m-gauge-face`, `--m-gauge-metal`, `--m-gauge-bezel`.

## Accessibility

- The gauge is a `role="meter"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`
  ("120 km/h"), named by `label`. The value spoken changes at most 4 times a second, so a live needle never floods a
  screen reader; the dial itself is hidden from it.
- The redline is told by the value and the ticks, not only by the colour. With reduced motion (or `motion={false}`)
  the needle stands on the value; an audio source then reads twice a second.
