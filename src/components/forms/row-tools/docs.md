# RowTools

The tools at the end of a row in an editable list: move up, move down, remove. Give it the row's `index` and the
list's `count` and the arrows switch off on the first and the last row.

```tsx
<RowTools index={i} count={() => rows().length} onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => remove(i)} />
<RowTools actions={["remove"]} onRemove={() => remove(i)} danger />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `actions` | `("up" \| "down" \| "remove")[]` | all three | which tools, in this order |
| `onUp`, `onDown`, `onRemove` | `() => void` | | |
| `onAction` | `(action) => void` | | one handler for every tool |
| `index` | `number` / accessor | | "up" is off at `0` |
| `count` | `number` / accessor | | "down" is off on the last row |
| `disabled` | `boolean` / accessor / `{ up?, down?, remove? }` | `false` | all tools, or some |
| `labels` | `{ up?, down?, remove?, group? }` | "Move up", "Move down", "Remove", "Row tools" (translated) | accessible names and tooltips |
| `icons` | `{ up?, down?, remove? }` | arrows and a cross | each an icon, text, a node or `() => node`; a node is copied for every row |
| `size` | `xs` `sm` `md` `lg` | IconButton default | |
| `m:color` | color token | | Common prop (march/props): the colour token of the component and everything in it. |
| `danger` | `boolean` | `false` | the remove tool in the danger colour |
| `class` | class value | | |

## Accessibility

A `group` named "Row tools"; each tool is an IconButton with its name as `aria-label` and tooltip. A tool that cannot
act (first row up, last row down) is disabled, not hidden, so the buttons never move under the pointer. Name the row in
`labels` when rows look alike ("Remove Ada").

## Composed of

IconButton.
