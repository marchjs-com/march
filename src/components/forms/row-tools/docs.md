# RowTools

The tools at the end of a row in an editable list: a drag grip, move up, move down, remove. Give it the row's `index`
and the list's `count` and the arrows switch off on the first and the last row. With `onReorder(from, to)` the grip
reorders a plain list: the row follows the pointer, the rows between slide aside, and `onReorder` is called once on
drop (Escape cancels); RowTools finds its row (`[data-m-row]`, else the nearest `li`). The row editors (ListEditor,
RecordListEditor) pass `onGrab` instead and drive their own drag, which shows the new order in the rows.

```tsx
<RowTools index={i} count={() => rows().length} onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => remove(i)} />
<RowTools actions={["remove"]} onRemove={() => remove(i)} danger />
<RowTools index={i} count={() => rows().length} onReorder={(from, to) => reorder(from, to)} … />   // drag, up, down, remove
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `actions` | `("drag" \| "up" \| "down" \| "remove")[]` | up, down, remove | which tools, in this order; also a string of names (`"drag up down"`) |
| `onUp`, `onDown`, `onRemove` | `() => void` | | |
| `onReorder` | `(from, to) => void` | | drag to reorder: called on drop; the default tools become drag, up, down, remove |
| `onGrab` | `(e: PointerEvent) => void` | | the pointerdown on the grip, to run your own drag instead (`pointerDrag`) |
| `onAction` | `(action) => void` | | one handler for every tool |
| `index` | `number` / accessor | | "up" is off at `0` |
| `count` | `number` / accessor | | "down" is off on the last row |
| `disabled` | `boolean` / accessor / `{ up?, down?, remove? }` | `false` | all tools, or some |
| `labels` | `{ drag?, up?, down?, remove?, group? }` | "Drag to reorder", "Move up", "Move down", "Remove", "Row tools" (translated) | accessible names and tooltips |
| `icons` | `{ drag?, up?, down?, remove? }` | a dotted grip, arrows and a cross | each an icon, text, a node or `() => node`; a node is copied for every row |
| `size` | `xs` `sm` `md` `lg` | IconButton default | |
| `m:color` | color token | | Common prop (march/props): the colour token of the component and everything in it. |
| `danger` | `boolean` | `false` | the remove tool in the danger colour |
| `class` | class value | | |

## Accessibility

A `group` named "Row tools"; each tool is an IconButton with its name as `aria-label` and tooltip. A tool that cannot
act (first row up, last row down) is disabled, not hidden, so the buttons never move under the pointer. Name the row in
`labels` when rows look alike ("Remove Ada"). The drag grip is for pointer, touch and pen and is hidden from screen
readers (its name is its tooltip): the arrows are the keyboard's way to reorder.

## Composed of

IconButton.
