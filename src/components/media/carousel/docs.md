# Carousel

A row of slides that scrolls and snaps: one to four per view on wide screens (a slide and a peek of the next on phones), previous / next buttons that hide at the ends, and a dot per position. Touch users swipe; the track is keyboard scrollable.

```tsx
<Carousel perView={3} label="Features">{items.map((x) => <FeatureCard {...x} />)}</Carousel>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `perView` | `1` `2` `3` `4` | `1` | slides per view on wide screens |
| `label` | `string` / accessor | "Carousel" (translated) | accessible name |
| children | nodes | | the slides |
| `class` | class value | | |

## Accessibility

A labelled `section` with `aria-roledescription="carousel"`. The track is focusable (arrow keys scroll it); the
previous / next buttons and the dots are labelled buttons ("Previous", "Next", "Slide n", translated); the active dot
is marked. The buttons sit at the inline edges and mirror in right-to-left layouts.

## Composed of

Nothing: native scroll snapping.
