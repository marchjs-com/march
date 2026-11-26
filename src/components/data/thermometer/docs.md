# Thermometer

A glass thermometer: a liquid column that rises and falls on a spring, a scale in °C or °F (or both, one on each side),
coloured zones beside the tube that also colour the liquid, and a rolling readout under the bulb. For weather cards,
smart-home rooms, server and engine temperatures, a fever chart. Values are always given in °C; `unit="F"` shows the
scale and the readout in Fahrenheit with round Fahrenheit ticks.

```tsx
<Thermometer value={$temp} />
<Thermometer value={$t} unit="F" secondary />
<Thermometer value={$t} min={-20} max={40} zones={[{ from: -20, to: 0, color: "info" }, { from: 28, to: 40, color: "danger" }]} />
```

## Design: why a new minimal component

A thermometer is a linear meter: a column in a tube with a bulb and a vertical scale. Gauge is a dial, so it does not
fit; Progress and LevelMeter are bars without a scale, a bulb or a liquid that springs. What exists is reused: the
charts' `niceStep` for round ticks in either unit, the motion engine's `track()` for the column, CountRoll for the
readout. `toFahrenheit` / `toCelsius` are exported.

## Props

| Prop | |
|---|---|
| `value` | The temperature in °C (it may be live). Required. |
| `unit` | `"C"` (default) or `"F"`: the scale, the readout and the spoken value. |
| `secondary` | A second scale in the other unit on the other side. |
| `min` / `max` | The scale in °C. Default −30…50. |
| `zones` | Coloured bands in °C: `[{ from, to, color }]`; the liquid takes the colour of the zone the value is in. |
| `color` | Theme color token of the liquid (instead of the zone colour; default red). |
| `step` | Major tick step in the shown unit. Default: a round step for about 8 ticks. |
| `format` | Intl.NumberFormat options of the readout and the spoken value. Default one decimal. |
| `size` | Height in px. Default 220. |
| `parts` | `tube`, `ticks`, `labels`, `zones`, `secondary`, `readout`, `glass` on or off. |
| `motion` | `false`: the column stands on the value at once; reduced motion does the same. |
| `label` | Accessible name. Default "Temperature". |

Class hooks: `m-thermo`, `m-thermo-svg`, `m-thermo-tube`, `m-thermo-zone`, `m-thermo-liquid`, `m-thermo-column`,
`m-thermo-bulb`, `m-thermo-scale` (`is-main`, `is-secondary`), `m-thermo-tick`, `m-thermo-label`, `m-thermo-unit`,
`m-thermo-shine`, `m-thermo-readout`. CSS variable `--m-thermo-h`.

## Accessibility

- A `role="meter"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext` ("23.5 °C") in the
  shown unit, named by `label`; the value spoken changes at most 4 times a second.
- Zones are also told by the value, not only by colour. The column moves on the motion engine; reduced motion (or
  `motion={false}`) puts it on the value at once.

## Composed of

CountRoll.
