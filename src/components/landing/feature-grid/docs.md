# FeatureGrid

What a product does, as a grid: `cards` (Cards with an IconTile; a soft light follows the pointer across the grid),
`plain` (no boxes), `list` (icon beside the text, two columns) or `bento` (tiles of different sizes with optional
media). Items enter one after another; tiles in a row share one height; on phones everything stacks.

```tsx
<FeatureGrid variant="bento" items={[
  { icon: zap, title: "Fast", body: "…", span: "big", media: <Screenshot /> },
  { icon: shieldCheck, title: "Secure", body: "…" },
  { icon: globe, title: "Every language", body: "…", span: "wide" },
]} />
<FeatureGrid variant="cards" cols={3} items={features} />
<FeatureGrid items={features} spotlight={false} reveal="none" />     // no pointer light, no entrance
<FeatureGrid items={features} reveal={{ from: { opacity: 0, transform: "rotate(-4deg) scale(.9)" }, to: { opacity: 1, transform: "rotate(0deg) scale(1)" } }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ icon?, title, body?, href?, tone?, span?, media? }[]` | — | `span`: `normal` `wide` `tall` `big` (bento) |
| `variant` | `cards` `plain` `list` `bento` | `cards` | |
| `cols` | 2 3 4 | 3 | cards / plain |
| `spotlight` | boolean | `true` | pointer light (cards, bento) |
| `reveal` | Reveal effect / `{ from, to }` / `none` | `up` | entrance of the tiles |
| `class` | string | — | extra class on the root (`.hm-fg`; parts: `.hm-fg-item`, `.hm-fg-title`, `.hm-fg-body`, `.hm-fg-media`) |

## Accessibility

Each item is an `<article>` with an `<h3>`; with `href` the title is the link and the whole tile is its hit area (one
tab stop, focus ring on the tile). Icons are decorative.

## Composed of

Grid, Card, IconTile, Reveal.
