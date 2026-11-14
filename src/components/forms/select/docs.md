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
| `placeholder` | string / `false` | `""` | the empty first option; `false`: no empty option |
| `disabled`, `readonly` | boolean | — | readonly disables the select |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

## Accessibility

A native select: keyboard, type-ahead and screen readers work as on any page; the label comes from its Field.

## Composed of

Nothing: a styled native select.
