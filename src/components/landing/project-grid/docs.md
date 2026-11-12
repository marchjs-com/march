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
| `allLabel` | string | `All` | |

Each cover is marked `data-hm-shared="project-<id>"`; `sharedTransition(name, fromElement, update)` (hadi-march/motion)
morphs it into the element with the same mark in the next view (ProjectDetail's cover), and back.

## Accessibility

Filters are toggle chips (`aria-pressed`) in a labelled group; each card is an article whose title link covers the card
(one tab stop). The grid is a polite live region so the new count is noticed. Covers reserve their size and load
lazily.

## Composed of

Card, Chip, openMedia (Lightbox), Reveal; `flip` and the motion engine.
