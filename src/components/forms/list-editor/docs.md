# ListEditor

Edit an array of strings in place: type and press Enter to add, edit any row, move rows up and down, remove them.
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

## Accessibility

A `role="group"` labelled by its Field; each row is named "Item 2", each button says what it does ("Move up", "Move
down", "Remove"); the add field takes the Field's id.

## Composed of

Nothing: inputs and icon buttons shared with KeyValueEditor (forms/rows.ts).
