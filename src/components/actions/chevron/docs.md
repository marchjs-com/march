# Chevron

The small arrow that turns when something opens: an accordion header, a disclosure, a tree row, a grouped table row.
It points to `direction` while closed and turns when open; right-to-left pages mirror it. Give it `open`, or leave it
out and the arrow follows the nearest ancestor with `aria-expanded` (or the summary of an open `<details>`).

```tsx
<Chevron open={$open} />
<button aria-expanded={$open} onClick={toggle}>Details <Chevron direction="down" /></button>
<Chevron open={$open} direction="down" motion="spring" size="lg" m:color="primary" icon={arrowRight} />
<Chevron leaf />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `open` | boolean / accessor | — | open state; omitted: follows the nearest `aria-expanded` ancestor or open `<details>` summary |
| `direction` | `end` `start` `down` `up` | `end` | where it points while closed (end and start turn down, down turns up, up turns down) |
| `size` | `xs` `sm` `md` `lg` | `sm` | |
| `motion` | `"smooth"` `"spring"` `false` | `"smooth"` | how it turns; `false` jumps |
| `icon` | icon / text / node | chevron | own mark, drawn pointing to the inline end |
| `m:color` | color token | — | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `leaf` | boolean | `false` | keeps the box, draws nothing (tree leaves line up) |
| `class` | class | — | |
| other attributes | | | `data-*`, `id` go to the arrow |

## Accessibility

The arrow is decoration (`aria-hidden`): the trigger carries the state with `aria-expanded`, which is also what the
arrow follows when `open` is not given. In a tree, where an open item contains closed ones, pass `open` per row. The
turn is a transform transition; reduced motion turns it off.

## Composed of

—
