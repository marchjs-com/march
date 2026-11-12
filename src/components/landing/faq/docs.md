# Faq

Frequently asked questions as an Accordion. `split` puts the heading and a contact line at the start (sticky) and the
questions at the end; `search` adds a SearchBox that narrows the list with the shared fuzzy ranking (accent- and
case-insensitive, typo tolerant) and announces how many questions match.

```tsx
<Faq layout="split" search title="Questions" lead="…" contact={<Button variant="secondary">Write to us</Button>}
  items={[{ q: "Is it free?", a: "Yes, MIT licensed." }, …]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ q, a, keywords? }[]` | — | `keywords`: extra words for search |
| `layout` | `center` `split` | `center` | |
| `title`, `lead`, `contact` | node | — | split layout |
| `search` | boolean | `false` | search box |
| `multiple` | boolean | `false` | several open at once |

## Accessibility

Accordion headers are buttons with `aria-expanded` / `aria-controls` and arrow-key movement; the match count is a polite
live region; the search box has an accessible name.

## Composed of

Accordion, SearchBox, Reveal; `rank` (shared fuzzy search).
