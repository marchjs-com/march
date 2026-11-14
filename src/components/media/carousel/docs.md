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
| `labels` | `{ previous, next, slide: (n) => string }` | translated texts | accessible names of the buttons and dots |
| `arrows` | `boolean` | `true` | the previous / next buttons |
| `prevIcon`, `nextIcon` | node / glyph | chevrons | what the buttons show |
| `dots` | `boolean` / `(index, active) => node` | `true` | `false`: no dots; a function draws its own content in each dot button |
| `color` | colour token | `primary` | the active dot |
| `smooth` | `boolean` | `true` | `false`: buttons and dots jump instead of scrolling smoothly |
| children | nodes | | the slides |
| `class` | class value | | |

```tsx
<Carousel perView={2} color="brand-orange" prevIcon={arrowLeft} nextIcon={arrowRight} labels={{ previous: "Earlier", next: "Later", slide: (n) => `Photo ${n}` }}>{slides}</Carousel>
<Carousel dots={(i) => i + 1} arrows={false} smooth={false}>{slides}</Carousel>
```

## Accessibility

A labelled `section` with `aria-roledescription="carousel"`. The track is focusable (arrow keys scroll it); the
previous / next buttons and the dots are labelled buttons ("Previous", "Next", "Slide n", translated); the active dot
is marked. The buttons sit at the inline edges and mirror in right-to-left layouts.

## Composed of

IconButton (`variant="raised"`, `shape="round"`: previous / next), PageDots (the dots); native scroll snapping.
