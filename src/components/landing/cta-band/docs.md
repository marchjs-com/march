# CtaBand

The "ready to start?" band near the end of a page: a rounded panel with a title, a lead and actions over a themed
background — `gradient` (brand colours), `mesh`, `glass`, `plain` or `video`. A light follows the pointer; the panel
scales in when it scrolls into view.

```tsx
<CtaBand variant="gradient" title="Start today" lead="…"
  actions={[{ label: "Try free", href: "/start", iconEnd: arrowRight }, { label: "Talk to sales" }]} note="14 days free" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `title`, `lead`, `note` | node | — | |
| `actions` | Hero actions or nodes | — | the first is primary |
| `variant` | `gradient` `mesh` `glass` `plain` `video` | `gradient` | |
| `video` | `{ src, poster? }` | — | video variant |
| `align` | `center` `start` | `center` | |

## Accessibility

A section with an `<h2>`; backgrounds are inert Overlays. On the gradient the buttons switch to light-on-dark colours
so the contrast holds.

## Composed of

SiteSection, Overlay, Reveal, VideoBackground; buttons from Hero's `actionButtons`.
