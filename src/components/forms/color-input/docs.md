# ColorInput

A color as `#rrggbb`: the native swatch picker and a text field side by side, kept in sync (typing a valid hex moves
the swatch; picking a swatch writes the text).

```tsx
<Field label="Brand color"><ColorInput bind:value={$color} /></Field>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | string | `""` | lower-case `#rrggbb` |
| `disabled`, `readonly` | boolean | — | |
| `swatch` | boolean | `true` | `false`: only the text field |
| `text` | boolean | `true` | `false`: only the swatch (it becomes the labelled control) |
| `swatchLabel` | string | "Pick a color" | accessible name of the swatch |
| `placeholder` | string | `"#RRGGBB"` | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

`<ColorInput bind:value={$c} text={false} swatchLabel="Marka rengi" />` shows only the swatch;
`<ColorInput bind:value={$c} swatch={false} placeholder="#hex" />` only the text field.

For palettes, gradients and contrast checks use ColorPicker.

## Accessibility

The swatch has its own name ("Pick a color"); the text field takes the Field label, so both are reachable by keyboard.

## Composed of

Nothing: two native inputs.
