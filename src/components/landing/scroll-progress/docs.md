# ScrollProgress

A thin bar that fills as the page (or one article) is read. Fixed to the top or inline; brand gradient or the accent.
The fill is a transform written in the scroll scene's write phase; in RTL it fills from the right.

```tsx
<ScrollProgress />
<ScrollProgress target={() => article} position="inline" paint="accent" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `target` | `() => Element` | page | measure one element (0 at its top, 1 at its end) |
| `position` | `fixed` `inline` | `fixed` | |
| `paint` | `gradient` `accent` | `gradient` | |
| `size` | px | `3` | height |

## Accessibility

`role="progressbar"` named "Reading progress" with `aria-valuenow` 0–100.

## Composed of

`scrollIndicator` and `onScrollProgress` (motion scroll core).
