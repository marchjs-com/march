# Kanban

A board: columns with a toned dot, a title and a count, and cards you move between columns by drag and drop or from the
keyboard (Alt+← / Alt+→ on a focused card). The board does not move cards itself: `onMove` tells you, you update the
columns.

```tsx
<Kanban columns={$board} itemKey={(x) => x.id} card={(x) => <strong>{x.title}</strong>}
  onMove={(item, from, to) => { $board = move($board, item, from, to) }} />
```

## Props

| Prop | Type | |
|---|---|---|
| `columns` | `{ id, title, tone?, items }[]` / accessor | the board |
| `card` | `(item) => node` | card content |
| `itemKey` | `(item) => string` | stable key |
| `onMove` | `(item, from, to) => void` | a card was dropped on another column |

`tone`: `primary` `info` `success` `warn`.

## Accessibility

Columns are labelled sections; cards are focusable and move with Alt+← / Alt+→, so the board works without a pointer.
The board scrolls sideways on narrow screens instead of crushing columns.
