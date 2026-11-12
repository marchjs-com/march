# Select

The native `<select>`, so phones show their own picker. Option values keep their type: a number stays a number, an
object stays the same object. For a handful of values prefer ChoicePicker or Segmented; for many, Combobox.

```tsx
<Field label="City"><Select bind:value={$city} options={cities} placeholder="Choose…" /></Field>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | option value | `null` | |
| `options` | `[value]` or `[{ value, label, disabled }]` | — | may be live |
| `placeholder` | string | `""` | the empty first option |
| `disabled`, `readonly` | boolean | — | readonly disables the select |

## Accessibility

A native select: keyboard, type-ahead and screen readers work as on any page; the label comes from its Field.

## Composed of

Nothing: a styled native select.
