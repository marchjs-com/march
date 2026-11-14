# Chip

A label pill. Three uses: a static label, a **filter** you can switch on and off (`selected` + `onClick`, announced
with `aria-pressed`), and a **removable** tag (`onRemove`, an ×-button with an accessible name).

```tsx
<Chip>Design</Chip>
<Chip selected={$on} onClick={() => $on = !$on}>Open</Chip>
<Chip tone="primary" onRemove={() => remove(tag)}>{tag}</Chip>
<Chip icon={tag} selected={$on} selectedIcon={false} onClick={toggle}>Design</Chip>   // no tick: the icon stays
<Chip selected={$on} selectedIcon={heart} onClick={toggle}>Liked</Chip>              // your own mark
<Chip onRemove={drop} removeIcon={trash} removeLabel="Delete tag">{tag}</Chip>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `tone` | `neutral` `primary` `success` `warn` `danger` `info` | `neutral` | colour family |
| `m:color` | ColorToken | theme primary | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `size` | `sm` `md` | `md` | |
| `icon` | icon | — | leading icon (a tick replaces it while selected) |
| `selected` | boolean / accessor | — | makes it a toggle button |
| `onClick` | `(e) => void` | — | makes it a toggle button |
| `selectedIcon` | boolean / node / icon | `true` | the tick of a selected chip: `false` keeps `icon`, a node or icon replaces the tick |
| `onRemove` | `() => void` | — | adds the remove button |
| `removeLabel` | string / accessor | "Remove" | accessible name of the remove button |
| `removeIcon` | node / icon | × | icon of the remove button |
| `class` | class | — | extra classes on the chip |
| `children` | node | — | the label |

## Accessibility

Toggle chips are buttons with `aria-pressed`; the remove button is a separate button ("Remove"). Long labels never
wrap: OverflowText scrolls them on hover and focus (still on reduced motion: the end fades instead).

## Composed of

OverflowText (the label), IconButton (`size="xs"`: the remove button). Uses the variant scale (hub d) for `size` and `tone`.
