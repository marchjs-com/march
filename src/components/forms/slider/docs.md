# Slider

A range slider with the value shown next to it (an `<output>`). `format` turns the number into text (a unit, a
percentage, a label).

```tsx
<Field label="Volume"><Slider bind:value={$vol} min={0} max={100} format={(v) => `${v} %`} /></Field>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | number | `min` | |
| `min`, `max`, `step` | number | `0`, `100`, `1` | |
| `format` | `(v) => node` | the number | text of the shown value |
| `color` | ColorToken | primary | |
| `showValue` | boolean | `true` | `false` removes the value next to the slider |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

`<Slider bind:value={$v} showValue={false} />` leaves only the track; `format` changes the text of the value.

## Accessibility

A native `<input type="range">`: arrows, Page Up / Down, Home / End work; its label comes from the Field and the
`<output>` is tied to it with `for`.

## Composed of

Nothing: a native range input and an output.
