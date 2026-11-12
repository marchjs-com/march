# Grid

A responsive grid that never overflows horizontally. Fixed columns (`cols`, 1–6) step down on tablets and phones,
or `min` gives automatic columns of at least that width. The last row can share the remaining space (`fill="stretch"`)
or give it to the last item (`fill="last"`), and `balance` picks the column count that spreads items evenly over the
rows (5 in 4 columns → 3 + 2, not 4 + 1). `equal` makes every row as tall as the tallest. Pure CSS (grid, flex-wrap and
`:has()`); no measuring script.

```tsx
<Grid cols={4} gap={3} fill="stretch" balance>{cards}</Grid>
<Grid min="16rem">{cards}</Grid>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `cols` | 1–6 | `2` | columns (fewer on narrow screens) |
| `min` | CSS length | — | automatic columns of at least this width |
| `gap` | 0–8 | `4` | spacing token step |
| `fill` | `"stretch"` / `"last"` | — | how the last row uses the remaining space |
| `balance` | boolean | `false` | spread items evenly over the rows |
| `minCol` | CSS length | `"9rem"` | narrowest column before fewer columns are used |
| `equal` | boolean | `false` | every row equally tall |

## Accessibility

No semantics of its own: use `as`-capable children (cards, list items) for structure. Reading order follows the source.

## Composed of

No other component.
