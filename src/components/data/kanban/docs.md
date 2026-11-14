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
| `columns` | `{ id, title, tone?, color?, items }[]` / accessor | the board |
| `card` | `(item) => node` | card content |
| `itemKey` | `(item) => string` | stable key |
| `onMove` | `(item, from, to) => void` | a card was dropped on another column |
| `dot` | boolean / `(column) => node` | the dot before a column title (default `true`), off, or your own mark |
| `count` | boolean / `(column) => node` | the card count (default `true`), off, or your own content |
| `animate` | boolean | cards scale in when they appear (default `true`) |
| `class` | class | extra class on the board |

`tone`: `primary` `info` `success` `warn`. A column's `color` takes any theme colour token (`brand-orange`, `cat-3` …)
and wins over `tone`.

```tsx
<Kanban columns={[{ id: "todo", title: "To do", color: "brand-purple", items }]} itemKey={(x) => x.id} card={card}
  dot={(col) => <Icon of={flag} />} count={(col) => `${col.items.length} / 5`} animate={false} />
```

## Accessibility

Columns are labelled sections; cards are focusable and move with Alt+← / Alt+→, so the board works without a pointer.
The board scrolls sideways on narrow screens instead of crushing columns.

## Composed of

PanelHeader (the column head), StatusDot (the dot) and Badge (the count).
