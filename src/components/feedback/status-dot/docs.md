# StatusDot

A small dot that shows a state: live, busy, changed, online. It takes a tone or a theme colour, can pulse, and is
either an image with a name (`label`) or decoration next to text that already says it.

```tsx
<StatusDot tone="success" pulse label="Live" />
<StatusDot color="brand-orange" size="xs" />
<span><StatusDot tone="warn" pulse="blink" /> Unsaved</span>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `tone` | `neutral` `primary` `info` `success` `warn` `danger` | `success` | meaning of the dot |
| `m:color` | color token | — | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `pulse` | boolean / `"ring"` / `"blink"` | `false` | `true` and `"ring"`: a breathing ring; `"blink"`: the dot fades |
| `size` | `xs` `sm` `md` `lg` | `md` | |
| `label` | string | — | accessible name; without it the dot is `aria-hidden` |
| `hollow` | boolean | `false` | a ring instead of a filled dot (a timeline point); children (an icon) sit inside |
| `class` | class | — | |
| other attributes | | | `data-*`, `title`, `id` go to the dot |

## Accessibility

With `label` the dot is `role="img"` with that name. Without it the dot is hidden from assistive technology: put the
state in the text beside it, never in the colour alone. The pulse stops under reduced motion.

## Composed of

—
