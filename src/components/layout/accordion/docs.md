# Accordion

Stacked sections with a header button each. By default opening one closes the others; `multiple` lets several stay
open. The panel height animates, ↑ ↓ Home End move between headers, and closed panels are inert. Headers can carry an
icon and a subtitle; `variant="contained"` draws one framed list instead of separate cards.

```tsx
<Accordion multiple open={[0]} items={[
  { title: "Shipping", subtitle: "2–3 days", content: <Shipping /> },
  { title: "Returns", content: <Returns /> },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `AccordionItem[]` | — | `{ id?, title, subtitle?, icon?, content, disabled? }` |
| `multiple` | boolean | `false` | several sections may be open |
| `open` | `(id or index)[]` | `[]` | initially open sections |
| `variant` | `"separated"` / `"contained"` | `"separated"` | look |

## Accessibility

Each header is a button in a heading with `aria-expanded` and `aria-controls`; panels are `role="region"` labelled by
their header and inert while closed. ↑ ↓ Home End move between headers (each stays a Tab stop).

## Composed of

No other component; the roving focus helper.
