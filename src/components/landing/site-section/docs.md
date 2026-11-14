# SiteSection

The frame of every website block: content width, vertical rhythm, a tone (plain, muted, inverse, brand) and an optional
heading group (eyebrow, title, lead) that enters with Reveal. Pages are a stack of sections.

```tsx
<SiteSection eyebrow="Features" title="Everything you need" lead="…" tone="muted">
  <FeatureGrid items={features} />
</SiteSection>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `eyebrow`, `title`, `lead` | node | — | heading group |
| `align` | `center` `start` | `center` | heading alignment |
| `tone` | `plain` `muted` `inverse` `brand` | `plain` | background |
| `width` | `narrow` `default` `wide` `full` | `default` | 46 / 72 / 84 rem / edge to edge |
| `space` | `none` `sm` `md` `lg` | `md` | vertical padding (fluid) |
| `level` | 1–3 | 2 | heading level |
| `color` | color token | accent | colour of the eyebrow, the `brand` tone and every accent inside |
| `reveal` | Reveal options / `false` | `{ effect: "up", stagger: 90 }` | entrance of the heading group |
| `class`, `id` | — | — | on the section; other attributes pass through |

```tsx
<SiteSection title="Pricing" tone="brand" color="brand-purple" reveal={{ effect: "blur", stagger: 140 }}>…</SiteSection>
<SiteSection title="FAQ" reveal={false}>…</SiteSection>
```

## Accessibility

A `<section>` labelled by its title (`aria-labelledby`). Use `level={1}` once on a page without a hero.

## Composed of

Reveal.
