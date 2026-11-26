# Stat

A KPI box: the label, the formatted value and its change against the previous period. The change is a fraction
(`delta={0.12}` → "+12 %") or computed from `previous`; it shows with an arrow, green when it is good and red when it is
bad (`invert` for costs, where a decrease is good). `spark` adds a trend line under the value.

```tsx
<Stat icon={wallet} label="Monthly income" value={$income} previous={$lastMonth} format={["money", "USD"]} spark={$days} hint="vs last month" />
<Stat label="Orders" value={1284} delta={0.068} />
<Stat label="Wait" value={4.2} delta={-0.12} invert format={(v) => `${v} min`} />
```

## Props

| Prop | |
|---|---|
| `label` | The label over the value. |
| `value` | The value (it may be live), formatted with `format`. |
| `format` | A pipe name, `[pipe, ...args]` or a function. Default "number". |
| `delta` | The change as a fraction (0.12 → +12 %). |
| `previous` | The previous value: `delta = (value − previous) / |previous|` when `delta` is not given. |
| `deltaFormat` | Format of |delta|. Default `["percent", 1]`. |
| `invert` | A decrease is good (costs, latency). |
| `hint` | Text after the change, e.g. "vs last week". |
| `spark` / `sparkY` | Data of a trend line under the value, and the value of an object row. |
| `icon` | An icon (march/icons) next to the label. |
| `empty` | Shown when there is no value. Default "—". |
| `class` | Extra classes on the root (`m-stat`). |
| `animate` | Change animation: `true` (default, a spring), `false`, an easing name or `{ duration, easing, delay, enter, update }`. |

## Accessibility

- The arrow is decoration; screen readers hear "Up", "Down" or "No change" before the change.
- Good and bad are told by the arrow and the sign, not only by the color.
- The sparkline is an image whose name is the label and a summary of its values.

## Motion

- A numeric value counts to its new number on the motion engine, formatted with `format` every frame and rounded to the
  target's decimals (no "1 234.5671" mid-way). The first value counts up from 0; `animate={{ enter: false }}` shows it
  at once.
- The delta arrow is one arrow that turns: up, sideways for no change, down; a change of direction turns it smoothly.
- `animate` is passed to the sparkline, which morphs to new data.
- `animate={false}` shows every change at once; reduced motion jumps.

Composed of StatTile (label over value) and Sparkline.
