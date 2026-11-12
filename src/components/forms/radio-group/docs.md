# RadioGroup

Radio buttons; the value is the chosen option value. Same looks as CheckboxGroup plus `segmented` (joined buttons).
Radio boxes are always round.

```tsx
<Field label="Size" group><RadioGroup bind:value={$size} inline options={["S", "M", "L", "XL"]} /></Field>
<RadioGroup variant="card" bind:value={$plan} options={plans} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | option value | `null` | |
| `options` | `[{ value, label, hint?, icon?, meta?, disabled? }]` | — | |
| `inline` | boolean | — | a row |
| `variant` | `classic` `soft` `chip` `card` `segmented` | `classic` | |
| `size`, `color`, `colors` | | | as CheckboxGroup |

## Accessibility

`role="radiogroup"` of native radios sharing one `name`: arrow keys move and select inside the group, Tab leaves it.

## Composed of

The drawn selection box shared with Checkbox (forms/choice.ts).
