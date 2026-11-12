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

## Accessibility

A `role="group"`; each pair is named "Key" / "Value", a duplicate key sets `aria-invalid` and shows an alert under
its row.

## Composed of

Nothing: inputs and the icon buttons shared with ListEditor (forms/rows.ts).
