# Faq

Frequently asked questions as an Accordion. `split` puts the heading and a contact line at the start (sticky) and the
questions at the end; `search` adds a SearchBox that narrows the list with the shared fuzzy ranking (accent- and
case-insensitive, typo tolerant) and announces how many questions match.

```tsx
<Faq layout="split" search title="Questions" lead="…" contact={<Button variant="secondary">Write to us</Button>}
  items={[{ q: "Is it free?", a: "Yes, MIT licensed." }, …]} />
<Faq search items={…} count={false} reveal="none"
  labels={{ search: "Type a word", empty: "Nothing found. Write to us.", count: (shown, total) => `${shown} / ${total}` }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ q, a, keywords? }[]` | — | `keywords`: extra words for search |
| `layout` | `center` `split` | `center` | |
| `title`, `lead`, `contact` | node | — | split layout |
| `search` | boolean | `false` | search box |
| `multiple` | boolean | `false` | several open at once |
| `labels` | `{ search, count, empty }` | translated | search placeholder and name, the count line (`(shown, total) => node`), the no-match text |
| `count` | boolean | `true` | the "3 of 12 questions" line under the search box |
| `reveal` | Reveal effect / `{ from, to }` / `none` | `up` | entrance of the heading column (split) |
| `class` | string | — | extra class on the root (`.m-faq`; parts: `.m-faq-aside` (a SectionHead: `.m-section-head-title`, `-lead`), `.m-faq-search`, `.m-faq-count`, `.m-faq-empty`) |

## Accessibility

Accordion headers are buttons with `aria-expanded` / `aria-controls` and arrow-key movement; the match count is a polite
live region; the search box has an accessible name.

## Composed of

Accordion, SearchBox, SectionHead (the split heading, with Reveal), Empty; `rank` (shared fuzzy search).
