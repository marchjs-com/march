# ProjectGrid

Portfolio work as cover cards with filter chips. Choosing a filter fades out what no longer matches and glides the rest
into their new places (FLIP); new matches scale in. Opening a card hands its cover to `onOpen` — for a shared element
transition into ProjectDetail — or, without it, shows the cover in the Lightbox.

```tsx
<ProjectGrid projects={work} onOpen={(p, cover) => sharedTransition(`project-${p.id}`, cover, () => { $open = p })} />
<ProjectGrid projects={work} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `projects` | `{ id, title, category?, year?, summary?, cover, href? }[]` | — | `cover`: `{ src, alt, width, height }` or a node |
| `filters` | boolean | `true` | chips from the categories (two or more) |
| `cols` | 2 3 | 3 | |
| `onOpen` | `(project, coverElement) => void` | — | |
| `lightbox` | boolean | `true` | without `onOpen`: cover in the Lightbox |
| `allLabel` | string | `All` | text of the "all" chip |
| `filtersLabel` | string | `Filter projects` | accessible name of the chip group |
| `color` | color token | accent | colour of the selected chip |
| `arrow` | boolean / `(project) => node` | `true` | the arrow badge on the cover, or your own content |
| `motion` | boolean | `true` | animate the filter change (false: swap at once) |
| `reveal` | Reveal options / `false` | `{ effect: "up", stagger: 70 }` | entrance of the cards |
| `class` | class | — | on the root |

```tsx
<ProjectGrid projects={work} color="brand-purple" arrow={(p) => <b>{p.year}</b>} reveal={{ effect: "scale", stagger: 40 }} />
<ProjectGrid projects={work} arrow={false} motion={false} reveal={false} filtersLabel="Filter the work" />
```

Each cover is marked `data-hm-shared="project-<id>"`; `sharedTransition(name, fromElement, update)` (hadi-march/motion)
morphs it into the element with the same mark in the next view (ProjectDetail's cover), and back.

## Accessibility

Filters are toggle chips (`aria-pressed`) in a labelled group; each card is an article whose title link covers the card
(one tab stop). The grid is a polite live region so the new count is noticed. Covers reserve their size and load
lazily.

## Composed of

Card, Chip, openMedia (Lightbox), Reveal; `flip` and the motion engine.
