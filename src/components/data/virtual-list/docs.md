# VirtualList

A long list that keeps only the rows near the viewport in the DOM, so 100,000 rows scroll like 20. Rows can have any
height: each is measured when it renders and an estimate stands in until then; when a row above the viewport changes
height the content stays still (scroll anchoring). Rows keep their DOM while they stay in range and receive an accessor
to their item, so an updated item (a like, an edit) updates its row instead of rebuilding it.

```tsx
<VirtualList items={$posts} key={(p) => p.id} render={(p) => <PostCard post={p} />} onEndReached={loadMore} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | array / accessor | — | |
| `key` | `(item, i) => string \| number` | index | keep rows across updates and reorders |
| `render` | `(item: () => T, i) => node` | — | `item()` follows updates of the same key |
| `estimate` | px | 120 | height of a row not measured yet |
| `overscan` | px | 600 | rendered beyond the viewport on both sides |
| `gap` | px | 0 | space between rows |
| `scroll` | `self` `parent` | `self` | `parent`: the nearest scrolling ancestor (a PullToRefresh, the page) |
| `onEndReached` | `() => void` | — | once per item count when the end is within `endDistance` |
| `endDistance` | px | 800 | |
| `header` / `footer` | node | — | before / after the rows, inside the scroll area |
| `label` | string | — | accessible name of the list |
| `role` | string | `list` | role of the rows' container; with another role (`listbox`, `menu`) the row wrappers are presentational and your rows carry the role, the state and `aria-setsize` |
| `id` | string | — | id of the rows' container (a field's `aria-controls`) |
| `api` | `(api) => void` | — | receives the handle once: `api.scrollToIndex(i, "nearest" \| "start" \| "center")` brings a row into view |

Reads and writes are batched on the motion engine's frame (`measure`), never per scroll event.

## Accessibility

The rows are a `role="list"` of `listitem`s with `aria-posinset` / `aria-setsize`, so screen readers announce "row 41
of 10,000" even though only a window exists. Keep focusable content inside rows: Tab moves through the rendered rows
and the list scrolls to follow focus.

## Composed of

Nothing: it is the windowing piece Feed, ChatThread and NotificationCenter are built on.
