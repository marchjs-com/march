# IconButton

A button that shows only an icon. `label` is required: it becomes the accessible name (`aria-label`) and the native
tooltip (`title`), so an icon-only control is never unnamed. Leaving it out throws while you develop.

```tsx
<IconButton icon={heart} label="Like" on:click={like} />
<IconButton icon={trash} label="Delete" variant="danger" size="sm" />
<IconButton icon={star} label="Star" color="brand-gold" title={false} />   // coloured, no native tooltip
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `icon` | icon | — | |
| `label` | string / accessor | — | required: accessible name and title |
| `size` | `sm` `md` | `md` | |
| `variant` | `danger` | — | tone |
| `color` | color token | — | colour of the icon |
| `title` | string / accessor / `false` | the label | native tooltip; `false`: none (e.g. inside a Tooltip) |
| `aria-label` | string / accessor | — | the name when no `label` is given (no tooltip then) |
| `class` | class | — | extra classes on the button |
| `children` | node | — | content when no `icon` is given (also a count Badge) |

Other attributes (`aria-pressed`, `onClick` …) go to the `<button>`. A count Badge placed inside sits on its corner.

## Accessibility

Always named; the hit area keeps the control size (2.25 rem, 1.75 rem small) even though the icon is small.
