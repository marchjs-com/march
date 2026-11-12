# Alert

A message that stays on the page: a tone (`info`, `success`, `warn`, `danger`, `neutral`), an optional bold title, the tone's icon (or your own) and an optional dismiss button. `Notice` is the same component.

```tsx
<Alert tone="warn" title="Quota" dismissable onDismiss={() => track("quota")}>90% of the storage is used this month.</Alert>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `tone` | `info` `success` `warn` `danger` `neutral` / accessor | `info` | colours and icon |
| `title` | node | | bold first line |
| `icon` | node / glyph / `null` | the tone's icon | `null` hides it |
| `body` / children | node | | the message |
| `dismissable` | `boolean` | `false` | adds a × button |
| `onDismiss` | `() => void` | | after it is hidden |
| `class` | class value | | |

## Accessibility

`warn` and `danger` alerts have `role="alert"` (announced at once); the others `role="status"` (polite). The dismiss
button is labelled "Dismiss" (translated). The icon is decorative. Colours come from the tone tokens and keep text
contrast in every theme.

## Composed of

Nothing: an icon and text.
