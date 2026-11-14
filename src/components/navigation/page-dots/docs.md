# PageDots

One dot per page; the current one is longer and takes the accent colour. Under a carousel, beside a story, in an
onboarding flow. With `onChange` (or `bind:value`) the dots are buttons; without it they only show where you are.

```tsx
<PageDots count={5} bind:value={$page} />
<PageDots count={steps.length} value={$active} color="brand-orange" />
<PageDots count={4} value={$i} onChange={(i) => $i = i} dot={(i) => i + 1} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `count` | `number` / accessor | | pages |
| `value` | `number` / accessor | `0` | current page, 0-based |
| `onChange` | `(index) => void` | | makes the dots buttons (`bind:value` works too) |
| `labels` | `{ group?, page?(n), status?(n, count) }` | "Pages", "Page n", "Page n of N" (translated) | accessible names |
| `color` | color token | accent | colour of the current dot |
| `size` | `sm` `md` `lg` | `md` | |
| `variant` | `pill` `dot` | `pill` | `dot`: every dot the same size |
| `orientation` | `horizontal` `vertical` | `horizontal` | |
| `dot` | `(index, active) => node` | | own content of a dot (a number, a thumbnail) |
| `decorative` | `boolean` | `false` | read-only dots hidden from screen readers |
| `disabled` | `boolean` / accessor | `false` | |
| `class` | class value | | |

## Accessibility

Interactive: a `group` of buttons, each named "Page n", the current one `aria-current="true"`. One tab stop (the
current dot); Left / Right (Up / Down when vertical, mirrored in right-to-left text), Home and End move and select.
The target around a dot is larger than the dot. Read-only: one image named "Page n of N" (or hidden with
`decorative`). Reduced motion: no size transition.

## Composed of

—
