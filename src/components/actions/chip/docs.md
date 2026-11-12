# Chip

A label pill. Three uses: a static label, a **filter** you can switch on and off (`selected` + `onClick`, announced
with `aria-pressed`), and a **removable** tag (`onRemove`, an ×-button with an accessible name).

```tsx
<Chip>Design</Chip>
<Chip selected={$on} onClick={() => $on = !$on}>Open</Chip>
<Chip tone="primary" onRemove={() => remove(tag)}>{tag}</Chip>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `tone` | `neutral` `primary` `success` `warn` `danger` `info` | `neutral` | colour family |
| `color` | ColorToken | theme primary | accent of a selected filter and of the primary tone |
| `size` | `sm` `md` | `md` | |
| `icon` | icon | — | leading icon (a tick replaces it while selected) |
| `selected` | boolean / accessor | — | makes it a toggle button |
| `onClick` | `(e) => void` | — | makes it a toggle button |
| `onRemove` | `() => void` | — | adds the remove button |

## Accessibility

Toggle chips are buttons with `aria-pressed`; the remove button is a separate button ("Remove"). Long labels never
wrap: OverflowText scrolls them on hover and focus (still on reduced motion: the end fades instead).

## Composed of

OverflowText. Uses the variant scale (hub d) for `size` and `tone`.
