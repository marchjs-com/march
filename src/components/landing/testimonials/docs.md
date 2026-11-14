# Testimonials

What customers say, in four layouts: `grid` (quote cards in equal rows), `marquee` (two endless rows drifting at
different speeds), `wall` (a masonry wall that fades out, with "Show more") and `slider` (a Carousel). Every card has
the quote, an optional star rating, an Avatar, the name and the role.

```tsx
<Testimonials variant="wall" items={[
  { quote: "Our new site was live in a week.", name: "Dana Ray", role: "Head of product, HADİ", rating: 5 },
  …
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ quote, name, role?, avatar?, rating? }[]` | — | |
| `variant` | `grid` `marquee` `wall` `slider` | `grid` | |
| `cols` | 1 2 3 | 3 | grid / slider |
| `rating` | boolean | `true` | the stars of a card |
| `ratingColor` | color token | accent | colour of the stars |
| `avatar` | boolean | `true` | the avatar next to the name |
| `quotes` | boolean | `true` | the quotation marks around the quote |
| `more` | boolean | `true` | wall: the "Show more" button (false: the whole wall) |
| `speed` | `[row1, row2]` px/s | `[28, 20]` | marquee: speed of the two rows |
| `reveal` | Reveal options / `false` | `{ effect: "up", stagger: 60 }` | entrance of the cards (grid, wall) |
| `labels` | `{ more?, less?, slider?, rating?(value) }` | built-in texts | any text Testimonials writes itself |
| `class` | class | — | on the root |

```tsx
<Testimonials variant="wall" items={quotes} ratingColor="brand-gold" labels={{ more: "Read more stories", less: "Fold" }} />
<Testimonials variant="marquee" items={quotes} avatar={false} rating={false} quotes={false} speed={[60, 40]} />
```

## Accessibility

Each card is a `<figure>` with a `<blockquote>` and a `<figcaption>` (`<cite>` for the name); the rating is read as
"4 out of 5". Ticker copies are hidden and inert; the wall's button has `aria-expanded`.

## Composed of

Card, Avatar, Rating, Marquee, Carousel, Button, Reveal.
