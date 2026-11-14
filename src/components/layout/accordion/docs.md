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
| `chevron` | boolean / icon / text / `(open, item) => node` | `true` | the arrow at the end of a header: off, your own mark, or drawn per section (`open()` is live) |
| `animated` | boolean | `true` | `false`: panels open at once and the arrow does not turn |
| `m:color` | color token | accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `onToggle` | `(key, open) => void` | — | a section opened or closed (key: its `id`, else its index) |
| `class` | class | — | added to the root (`.m-accordion`); parts: `.m-acc-item`, `.m-acc-btn`, `.m-acc-icon`, `.m-acc-title`, `.m-acc-sub`, `.m-acc-chev`, `.m-acc-body` |

```tsx
<Accordion items={faq} chevron={false} />                                   // no arrow
<Accordion items={faq} chevron={plus} m:color="brand-orange" />               // your own icon (it turns with the section)
<Accordion items={faq} chevron={(open) => <b>{() => (open() ? "−" : "+")}</b>} animated={false} />
```

## Accessibility

Each header is a button in a heading with `aria-expanded` and `aria-controls`; panels are `role="region"` labelled by
their header and inert while closed. ↑ ↓ Home End move between headers (each stays a Tab stop).

## Composed of

ListRow (a header: icon, title, subtitle; its plain form, so no scrolling text is loaded), Chevron (the arrow of a header); the roving focus helper.
