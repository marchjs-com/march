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

## Accessibility

Each card is a `<figure>` with a `<blockquote>` and a `<figcaption>` (`<cite>` for the name); the rating is read as
"4 out of 5". Ticker copies are hidden and inert; the wall's button has `aria-expanded`.

## Composed of

Card, Avatar, Rating, Marquee, Carousel, Button, Reveal.
