# Pagination

Numbered pages with ellipses: the first and last pages, the current page and `siblings` pages on each side stay
visible, the rest collapse into a gap. Previous / Next buttons are disabled at the ends. Pages are 1-based.

```tsx
<Pagination bind:page={$page} pages={20} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `page` | number / accessor | — | current page (1-based) |
| `pages` | number / accessor | — | page count |
| `onPage` / `setPage` | `(p) => void` | — | called with the chosen page (`bind:page` works) |
| `siblings` | number | `1` | pages shown on each side of the current one |

## Accessibility

A `<nav>` named "Pagination"; the current page has `aria-current="page"`; Previous / Next have accessible names and are
disabled at the ends; the ellipsis is hidden from assistive technology.

## Composed of

No other component: buttons and icons only.
