# AttitudeIndicator

An artificial horizon, the instrument at the centre of every cockpit: sky and ground meet at a horizon that tilts with
the bank and moves with the pitch, a pitch ladder marks every 5° and 10°, a roll scale (10, 20, 30, 45, 60°) sits on
the bezel with a sky pointer that follows the bank, and a fixed aircraft symbol stays in the middle. For flight
simulators, drone and robot telemetry, a phone's tilt (device orientation), a game HUD.

```tsx
<AttitudeIndicator pitch={$pitch} roll={$roll} />
<AttitudeIndicator pitch={$p} roll={$r} range={20} colors={{ sky: "brand-blue", ground: "brand-gold" }} />
<AttitudeIndicator pitch={$p} roll={$r} parts={{ labels: false, pointer: false }} motion={false} />
```

## Design: why it composes Gauge (and what is new)

The case, bezel, glass and roll scale are a dial: a Gauge with a full-circle scale whose 0 is at the top
(`min={-180} max={180} sweep={360} start={-180}`) and marks only at the roll angles; its peak mark at a number is the
sky pointer. What no dial has is the horizon card (sky, ground, horizon line and pitch ladder, turned by the bank and
moved by the pitch) and the fixed aircraft symbol: they are new, drawn on the Gauge's face through its `inlay`, under
the roll scale and the glass. Pitch and roll move on the motion engine's spring (`track`), like a gyro.

## Props

| Prop | |
|---|---|
| `pitch` | Degrees, positive nose up (−90…90). Required. |
| `roll` | Bank in degrees, positive right wing down (−180…180). Required. |
| `range` | Degrees of pitch from the horizon to the rim (the ladder's scale). Default 40. |
| `colors` | `{ sky, ground }` theme color tokens. Default `info` and `brand-orange`. |
| `color` | Theme color token of the aircraft symbol. Default `"warning"`. |
| `size` | Width in px. Default 220. |
| `parts` | `face`, `ladder`, `labels`, `rollScale`, `pointer`, `aircraft`, `glass` on or off. |
| `motion` | `false`: the horizon stands on the attitude at once; reduced motion does the same. |
| `label` | Accessible name. Default "Attitude". |

Class hooks: `m-att`, `m-att-svg`, `m-att-card`, `m-att-sky`, `m-att-ground`, `m-att-horizon`, `m-att-ladder`,
`m-att-rung` (`is-major`, `is-minor`), `m-att-num`, `m-att-aircraft`, and the Gauge hooks (`m-gauge-peak` is the sky
pointer, `m-gauge-tick` the roll scale). CSS variable `--m-att-mark` (aircraft colour).

## Accessibility

- A `role="img"` named "Attitude: pitch 5° up, bank 10° right" ("level" at zero), updated at most 4 times a second;
  the drawing is hidden from screen readers.
- Pitch and roll move on the motion engine; reduced motion (or `motion={false}`) puts the horizon in place at once.

## Composed of

Gauge.
