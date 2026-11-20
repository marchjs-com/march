# ListEditor

Edit an array of strings in place: type and press Enter to add, edit any row, move rows up and down (or drag a row by
its grip), remove them.
Pasting several lines adds one item per line; duplicates are skipped unless `unique={false}`; `max` caps the list.

```tsx
<Field label="Tags" group><ListEditor bind:value={$tags} max={10} placeholder="Add a tag" /></Field>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `string[]` | `[]` | |
| `placeholder` | string | "Add an item" | |
| `max` | number | — | |
| `unique` | boolean | `true` | |
| `addLabel` | string | "Add" | |
| `readonly`, `disabled` | boolean | — | hides the editing buttons |
| `labels` | `{ item?(position), moveUp?, moveDown?, remove? }` | "Item 2", "Move up", "Move down", "Remove" | accessible names |
| `sortable` | boolean | `true` | `false` removes the move buttons and the drag grips |
| `removable` | boolean | `true` | `false` removes the remove button |
| `addable` | boolean | `true` | `false` removes the add line |
| `icons` | `{ up?, down?, remove? }` (node, text or `() => node`) | ↑ ↓ × icons | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

`<ListEditor bind:value={$tags} sortable={false} icons={{ remove: () => <Icon of={trash} /> }}
labels={{ item: (n) => `${n}. etiket`, remove: "Kaldır" }} addLabel="Ekle" placeholder="Etiket ekle" />`.

## Accessibility

A `role="group"` labelled by its Field; each row is named "Item 2", each button says what it does ("Move up", "Move
down", "Remove"); the add field takes the Field's id. The drag grip at the start of a row is for pointer, touch and pen (hidden
from screen readers); the keyboard reorders with the move buttons. Escape during a drag puts the row back.

## Composed of

TextInput (the rows and the draft line), RowTools (move up / down, remove) and Button (add); the row logic is shared
with KeyValueEditor and RecordListEditor (forms/rows.ts).
