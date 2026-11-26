# BatteryGauge

A battery's charge in the familiar battery shape: a case with a terminal cap, a fill (or lit cells) that springs to the
level, colours that turn amber when low and red when critical, a bolt while charging and a rolling percentage inside or
beside it. For device lists, IoT and fleet dashboards, a phone mock-up, an electric car's range card, a game's energy.

```tsx
<BatteryGauge value={$battery} charging={$plugged} />
<BatteryGauge value={18} variant="segments" segments={5} />
<BatteryGauge value={$level} orientation="vertical" readout="outside" low={30} onStateChange={(s) => s === "critical" && warn()} />
```

## Design: why a new minimal component

A battery is a linear meter in a shape everyone recognises, with states (low, critical, charging) that change its
colour. Gauge is a dial; LevelMeter is an audio segment meter with peak and clip lights; Progress shows a task's
progress, not a charge. BatteryGauge reuses the motion engine's `track()` for the fill (a transform, so the spring
never lays out), CountRoll for the percentage and the built-in `zap` icon for the bolt.

## Props

| Prop | |
|---|---|
| `value` | Charge in percent, 0–100 (it may be live). Required. |
| `charging` | Shows the bolt (instead of the inside percentage) and the charging colour. |
| `low` / `critical` | Thresholds of the amber and red states. Default 20 and 10. |
| `variant` | `"fill"` (default) or `"segments"`; `segments`: 2–10 cells (default 5), the last one lit by its share. |
| `orientation` | `"horizontal"` (default; fills from the inline start, RTL too) or `"vertical"` (cap on top). |
| `readout` | `"inside"` (default), `"outside"` or `false`. |
| `chargeIcon` | The charging icon (an icon, a node, text); `false`: none. Default a bolt. |
| `color` | Theme color token of the fill instead of the state colours. |
| `size` | Length of the long side in px. Default 96. |
| `parts` | `cap`, `bolt`, `readout`, `frame` on or off. |
| `motion` | `false`: the fill stands on the level at once; reduced motion does the same. |
| `label` | Accessible name. Default "Battery". |
| `onStateChange` | `(state, value)` when it becomes `"ok"`, `"low"` or `"critical"`. |

Class hooks: `m-battery` (+ `is-horizontal` / `is-vertical`, `is-ok` / `is-low` / `is-critical`, `is-charging`,
`is-segments`, `m-battery-bare`), `m-battery-case`, `m-battery-body`, `m-battery-fill`, `m-battery-cells`,
`m-battery-cell`, `m-battery-cap`, `m-battery-bolt`, `m-battery-readout` (`is-inside`, `is-outside`). CSS variables:
`--m-battery-w`, `--m-battery-fill`, `--m-battery-level`.

## Accessibility

- A `role="meter"` 0–100 named by `label`; its value text says the state in words ("8%, charging, critical"), so the
  state is never told by colour alone.
- The fill moves on the motion engine; reduced motion (or `motion={false}`) puts it on the level at once.

## Composed of

CountRoll.
