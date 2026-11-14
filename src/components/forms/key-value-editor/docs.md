# KeyValueEditor

Edit an object as rows of key and value. Rows keep their order, empty keys are skipped, a duplicate key is flagged on
its row, and with `numbers` numeric-looking values are stored as numbers.

```tsx
<Field label="Labels" group><KeyValueEditor bind:value={$labels} /></Field>
<KeyValueEditor bind:value={$limits} numbers keyPlaceholder="Plan" valuePlaceholder="Seats" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `Record<string, string \| number>` | `{}` | |
| `keyPlaceholder`, `valuePlaceholder` | string | "Key", "Value" | |
| `numbers` | boolean | — | numeric-looking values become numbers |
| `readonly`, `disabled` | boolean | — | hides the editing buttons |
| `labels` | `{ key?, value?, remove?, add?, duplicate? }` | "Key", "Value", "Remove", "Add row", "Duplicate key" | |
| `removable` | boolean | `true` | `false` removes the row's remove button |
| `addable` | boolean | `true` | `false` removes the "Add row" button |
| `removeIcon` | node, text or `() => node` | × icon | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

`<KeyValueEditor bind:value={$env} labels={{ key: "Ad", value: "Değer", add: "Satır ekle" }} removeIcon={() => <Icon of={trash} />} />`;
`removable={false} addable={false}` leaves a fixed set of rows to fill in.

## Accessibility

A `role="group"`; each pair is named "Key" / "Value", a duplicate key sets `aria-invalid` and shows an alert under
its row.

## Composed of

TextInput (key and value), RowTools (remove) and Button (add row); the row logic is shared with ListEditor and
RecordListEditor (forms/rows.ts).
