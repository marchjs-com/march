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
| `onAdd` | `(id, type) => void` | — | after a node is added |

## Accessibility

A region named "Node types"; every card is a button named by its label and description and described by a hint
("drag, or press Enter to add it in the middle"). Adding from the keyboard needs no pointer at all. Reduced motion:
no tilt or fly-back, the node simply appears.

## Composed of

SearchBox, OverflowText; FlowCanvas's store and view (`flow.view`), the Portal drag layer and the motion engine.
