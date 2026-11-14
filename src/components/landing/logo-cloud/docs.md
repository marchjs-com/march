# LogoCloud

"Trusted by" logos. `grid` lines them up in equal cells that light up on hover; `marquee` runs them as an endless
ticker (Marquee: edges fade, it stops off screen, reduced motion keeps it still). Logos share one muted tone by
default and show their colour on hover.

```tsx
<LogoCloud title="Trusted by teams at" variant="marquee" logos={[
  { name: "HADİ", src: "/logos/hadi.svg", width: 120, height: 32 },
  { name: "Northwind", node: <NorthwindLogo /> },
]} />
<LogoCloud logos={logos} reveal="up" />     // grid: another entrance; reveal="none": the logos are simply there
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `logos` | `{ name, src?, width?, height?, node?, href? }[]` | — | `name` is the accessible name |
| `variant` | `grid` `marquee` | `grid` | |
| `title` | node | — | small heading |
| `mono` | boolean | `true` | one muted tone, colour on hover |
| `speed` | px/s | `40` | marquee |
| `reveal` | Reveal effect / `{ from, to }` / `none` | `fade` | grid: entrance of the cells |
| `class` | string | — | extra class on the root (`.hm-logos`; parts: `.hm-logos-title`, `.hm-logos-cell`, `.hm-logo`, `.hm-logo-img`) |

## Accessibility

Each logo is an image with the company name as its text alternative (`alt`, or `aria-label` for inline nodes). The
ticker copies are `aria-hidden` and inert, so every name is read once. Images load lazily with their size reserved.

## Composed of

Marquee, Grid, Reveal.
