# FlowPalette

The node types of a flow, grouped by category, with a search box (accent and Turkish-letter insensitive). Drag a card
onto a FlowCanvas to place the node where you drop it, snapped to the grid; a click or Enter adds it in the middle of
the view. The dragged card floats in the drag layer, tilts while it is held and melts into the canvas (or flies back
when dropped outside) on the motion engine.

```tsx
const flow = createFlow({ types })
<FlowPalette flow={flow} />
<FlowCanvas flow={flow} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `flow` | `FlowStore` | — | the store the canvas draws |
| `types` | `FlowNodeType[]` | all of `flow.types` | the types to offer |
| `snap` | number | `16` | grid step used when dropping (match the canvas) |
| `search` | boolean | `true` | show the search box |
| `categories` | boolean | `true` | the category titles |
| `descriptions` | boolean | `true` | the description line of a card |
| `grip` | boolean | `true` | the grip dots at the end of a card |
| `renderCard` | `(type) => node` | — | own card content; the card stays a button (drag, click, Enter) |
| `empty` | boolean / node | `true` | what a search without a match shows |
| `motion` | boolean | `true` | tilt, melt and fly-back of the dragged card |
| `labels` | `{ region, search, hint, empty }` | — | own texts (each falls back to the built-in one) |
| `onAdd` | `(id, type) => void` | — | after a node is added |
| `class` | class value | — | on the root (`hm-flowpal`) |

```tsx
<FlowPalette flow={flow} grip={false} descriptions={false} categories={false}
  labels={{ search: "Find a step", empty: "Nothing here" }}
  renderCard={(type) => <b>{type.label}</b>} />
```

## Accessibility

A region named "Node types"; every card is a button named by its label and description and described by a hint
("drag, or press Enter to add it in the middle"). Adding from the keyboard needs no pointer at all. Reduced motion:
no tilt or fly-back, the node simply appears.

## Composed of

SearchBox, ListRow (a card), IconTile (type icon), OverflowText, SectionLabel (category title), Empty; FlowCanvas's store
and view (`flow.view`), the drag behavior with its ghost (`dragGhost`) and the motion engine.
