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
| `m:color` | ColorToken | primary | Common prop (march/props): the colour token of the component and everything in it. |
| `showValue` | boolean | `true` | `false` removes the value next to the slider |
| `track` | `true` / class name / node | — | your own track under a drawn thumb: `true` a ramp in the control's color, a class (your gradient) or a node |
| `valueText` | `(v) => string` | — | spoken value (`aria-valuetext`) |
| `onCommit` | `(v) => void` | — | called once when a change is finished (pointer released), after `onChange` |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

`<Slider bind:value={$v} showValue={false} />` leaves only the track; `format` changes the text of the value.

```tsx
<Slider bind:value={$level} track />                                        // a ramp in the control's color
<Slider bind:value={$hue} max={360} track="my-hue-strip" showValue={false}  // .my-hue-strip { background: linear-gradient(…) }
  valueText={(v) => `${v} degrees`} onCommit={remember} aria-label="Hue" />
```

With `track` the input stays a native range (keyboard, forms, screen readers); only its track is cleared and the thumb
drawn. `--m-slider-thumb` on the control (or an ancestor) fills the thumb, e.g. with the picked colour.

## Accessibility

A native `<input type="range">`: arrows, Page Up / Down, Home / End work; its label comes from the Field and the
`<output>` is tied to it with `for`.

## Composed of

Nothing: a native range input and an output.
