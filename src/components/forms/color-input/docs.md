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

For palettes, gradients and contrast checks use ColorPicker.

## Accessibility

The swatch has its own name ("Pick a color"); the text field takes the Field label, so both are reachable by keyboard.

## Composed of

Nothing: two native inputs.
