# Empty

What a list, table or page shows when it has nothing yet: an icon in a raised tile, a title, a line of text and the next step as buttons. An empty screen that says what to do next.

```tsx
<Empty icon={inbox} title="No messages yet" action={[<Button variant="primary" icon={plus}>New message</Button>]}>Start a conversation or invite a teammate.</Empty>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `icon` | node / glyph / emoji | | shown in a raised tile |
| `title` | `string` / accessor / `false` | "Nothing here yet" (translated) | `false` leaves the title out |
| `action` | node / list / `action()` objects | | actions render as buttons |
| children | node | | the explanation |
| `class` | class value | | |

```tsx
<Empty title={false} icon={inbox}>Only the icon and this line.</Empty>
```

## Accessibility

Plain content: the title is a paragraph in the reading order, the icon is decorative, the actions are ordinary buttons
reachable with Tab. Tables and the router use the same `hm-empty` look for their own empty states.

## Composed of

Nothing; `action()` objects become ActionButtons.
