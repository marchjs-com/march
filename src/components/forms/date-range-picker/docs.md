# DateRangePicker

A date range `{ from, to }` (either end may be open). Presets — today, the last 7 / 30 / 90 days, this month — sit in a
Segmented row; "Custom" shows a from / to pair of DatePickers that keep each other in order. `rangePresets(today)`
returns the built-in presets for your own list.

```tsx
<Field label="Report period" group><DateRangePicker bind:value={$range} /></Field>
<DateRangePicker bind:value={$range} presets={false} max={todayIso()} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `{ from, to } \| null` | `null` | |
| `presets` | `RangePreset[]` or `false` | built-in | |
| `today` | IsoDate | today | base of the built-in presets |
| `min`, `max`, `firstDay` | | | for the custom pair |
| `labels` | `{ range?, custom?, from?, to? }` | "Date range", "Custom", "From", "To" | |
| `custom` | boolean | `true` | `false` removes the "Custom" option |
| `separator` | `false`, node, text or `() => node` | "–" | between the two date fields |
| `picker` | `Partial<DatePickerProps>` | — | extra props for both DatePickers (`icon`, `labels`, `calendar`, `locale`) |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

`<DateRangePicker bind:value={$r} labels={{ custom: "Kendi aralığım", from: "Başlangıç", to: "Bitiş" }} separator="→"
picker={{ icon: false }} />`; `custom={false}` offers only the presets. Preset texts come from your `presets`.

## Accessibility

A `role="group"` labelled by its Field; the presets are a radiogroup ("Date range"), the custom fields are named
"From" and "To".

## Composed of

Segmented (presets) and DatePicker (the custom pair).
