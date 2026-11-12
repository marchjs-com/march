# DateTimeInput

A date and a time edited side by side, stored as one ISO timestamp in UTC (like `new Date().toISOString()`) and shown
in local time. Picking only a date uses `defaultTime`.

```tsx
<Field label="Starts"><DateTimeInput bind:value={$startsAt} defaultTime="09:00" /></Field>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | ISO timestamp or `null` | `null` | |
| `min`, `max` | IsoDate | — | for the date part |
| `firstDay` | 0–6 | locale | |
| `defaultTime` | `"HH:MM"` | `"00:00"` | |

## Accessibility

The date part takes the Field label; the time part is named "Time". Both are ordinary inputs in the Tab order.

## Composed of

DatePicker and TimeInput.
