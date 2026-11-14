# Swatch

A sample of a colour or a gradient: the squares of a palette, the presets of a gradient editor, the tones of a theme
scale. With `onClick` it is a button that says whether it is selected; without it, a picture. Transparent colours show
over a checkerboard.

```tsx
<Swatch color="#ff7a1a" label="Orange" selected={$c === "#ff7a1a"} onClick={() => $c = "#ff7a1a"} />
<Swatch color="linear-gradient(135deg, #ff7a1a, #7c3aed)" shape="circle" size="lg" mark />
<Swatch color="rgb(37 99 235 / .4)" label="Blue, 40%" />
<Swatch color="brand-green" />
<div class={CHECKER} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `color` | CSS colour / gradient / color token | — | set as a custom property through the CSSOM (no style string); a token goes through `data-hm-color` |
| `selected` | boolean / accessor | — | ring around it; said as `aria-pressed` (or `aria-checked` / `aria-selected` with a matching `role`) |
| `label` | string | — | accessible name; tooltip of a clickable swatch |
| `size` | `xs` `sm` `md` `lg` | `md` | |
| `shape` | `round` `square` `circle` | `round` | |
| `checker` | boolean | `true` | checkerboard under the colour |
| `mark` | `true` / icon / text / node / `false` | `false` | mark on a selected swatch (`true`: a tick) |
| `onClick` | function | — | makes it a button |
| `disabled` | boolean | `false` | |
| `children` | node | — | content over the colour ("Aa") |
| `class` | class | — | |
| other attributes | | | `role`, `aria-*`, `data-*`, `tabindex`, `title`, `id` go to the swatch |

`CHECKER` is the class of the shared checkerboard (`--hm-checker-size`, `--hm-checker-a`, `--hm-checker-b` tune it):
put it on any element that shows transparency (an alpha track, an image stage).

## Accessibility

A clickable swatch is a `<button>`: give it a `label` (the colour's name), since colour alone says nothing to a screen
reader. `selected` is announced as pressed; inside a `radiogroup` pass `role="radio"` and it becomes `aria-checked`
(with `role="option"`: `aria-selected`). A static swatch with a label is `role="img"`, without one it is decoration.
The selected ring uses the text colour, so it is visible around any colour; hover motion stops under reduced motion.

## Composed of

—
