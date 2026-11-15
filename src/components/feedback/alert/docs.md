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
| `action` | node / list / `action()` objects | | the next step; actions render as small buttons |
| `actionPlacement` | `end` `below` | `end` | beside the text (before the × button) or under it |
| `variant` | `soft` `raised` | `soft` | `raised`: a floating message (Toast) on a layer surface with a shadow; the tone colours the icon alone |
| `role` | string | by tone | the ARIA role instead of the tone's (`alert` for danger / warn, `status` otherwise) |
| `partClass` | `{ icon, body, dismiss }` | | extra classes of the parts (a host's own hooks) |
| `dismissable` | `boolean` | `false` | adds a × button |
| `dismissLabel` | `string` / accessor | "Dismiss" (translated) | accessible name of the × button |
| `dismissIcon` | node / glyph | the × glyph | what the dismiss button shows |
| `m:color` | colour token | the tone's | Common prop (march/props): the colour token of the component and everything in it. |
| `onDismiss` | `() => void` | | after it is hidden |
| `class` | class value | | |

```tsx
<Alert m:color="brand-purple" icon={sparkles} title="New">Dark theme is here.</Alert>
<Alert dismissable dismissLabel="Close the notice" dismissIcon={check} icon={null}>Saved.</Alert>
<Alert tone="danger" title="Could not load" actionPlacement="below" action={<Button size="sm" onClick={retry}>Retry</Button>}>The server did not answer.</Alert>
<Alert tone="info" dismissable action={[reload]}>A new version is ready.</Alert>
```

## Accessibility

`warn` and `danger` alerts have `role="alert"` (announced at once); the others `role="status"` (polite). The dismiss
button is labelled "Dismiss" (translated). Actions are ordinary buttons after the text in the Tab order, before the
dismiss button. The icon is decorative. Colours come from the tone tokens and keep text
contrast in every theme.

## Composed of

IconButton (the dismiss button); `action()` objects become ActionButtons. `toneIcon(tone)` is the shared tone → icon table.
