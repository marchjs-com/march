# IconButton

A button that shows only an icon. `label` is required: it becomes the accessible name (`aria-label`) and the native
tooltip (`title`), so an icon-only control is never unnamed. Leaving it out throws while you develop.

```tsx
<IconButton icon={heart} label="Like" on:click={like} />
<IconButton icon={trash} label="Delete" variant="danger" size="sm" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `icon` | icon | — | |
| `label` | string / accessor | — | required: accessible name and title |
| `size` | `sm` `md` | `md` | |
| `variant` | `danger` | — | tone |

Other attributes (`aria-pressed`, `onClick` …) go to the `<button>`. A count Badge placed inside sits on its corner.

## Accessibility

Always named; the hit area keeps the control size (2.25 rem, 1.75 rem small) even though the icon is small.
