# Card

A surface for one piece of content: an optional header with a title, a subtitle and actions, the body, and an optional
footer. `action()` objects in `actions` render as buttons that run, confirm and report the action.

```tsx
<Card title="Acme Ltd." subtitle="Business plan" actions={[edit]} footer={<span>Updated today</span>}>…</Card>
<Card flush>…</Card>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `title` | node | — | header title (`h3`) |
| `subtitle` | node | — | line under the title |
| `actions` | action() / nodes | — | header actions |
| `footer` | node | — | footer row |
| `flush` | boolean | `false` | no body padding (tables, lists) |
| `as` | tag | `section` | root element |

Other attributes go to the root element.

## Accessibility

The title is a heading, so the card is reachable with heading navigation. The card never overflows its column: the
body is `min-width: 0` and the header wraps.
