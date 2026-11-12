# TimeInput

The browser's own time field: the value is `"HH:MM"` (`"HH:MM:SS"` with a step under a minute), in the user's
12- or 24-hour display.

```tsx
<Field label="Start"><TimeInput bind:value={$start} min="09:00" max="18:00" /></Field>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | string | `""` | |
| `min`, `max` | `"HH:MM"` | — | |
| `step` | seconds | — | `1` shows seconds |
| `disabled`, `readonly` | boolean | — | |

## Accessibility

A native `<input type="time">`: each part is spin-button editable with the arrow keys and announced by screen readers.

## Composed of

Nothing: a styled native input.
