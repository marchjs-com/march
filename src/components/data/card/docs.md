# Card

A surface for one piece of content: an optional header with a title, a subtitle and actions, the body, and an optional
footer. `action()` objects in `actions` render as buttons that run, confirm and report the action.

```tsx
<Card title="HADİ" subtitle="Business plan" actions={[edit]} footer={<span>Updated today</span>}>…</Card>
<Card flush>…</Card>
<Card as="article" plain>…</Card>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `title` | node | — | header title (`h3`) |
| `subtitle` | node | — | line under the title |
| `actions` | action() / nodes | — | header actions |
| `footer` | node | — | footer row |
| `flush` | boolean | `false` | no body padding (tables, lists) |
| `plain` | boolean / accessor | `false` | no frame (background, border, radius, shadow) |
| `as` | tag | `section` | root element (`article` for a post, a product) |

Other attributes go to the root element.

## Accessibility

The title is a heading, so the card is reachable with heading navigation. The card never overflows its column: the
body is `min-width: 0` and the header wraps.

## Composed of

PanelHeader (the header: title, subtitle, actions).
