# SiteFooter

The end of a website: brand and a short line about the product, link columns, social links, an optional Newsletter and
a bottom row (copyright, legal links, back to top). Columns fold to two per row on tablets and stack on phones; an
optional big wordmark fills the last line.

```tsx
<SiteFooter brand={{ name: "HADİ", mark: logo }} about="…" wordmark="HADİ"
  columns={[{ title: "Product", links: [{ label: "Pricing", href: "/pricing" }] }]}
  social={[{ label: "Blog", href: "/blog", icon: globe }]}
  newsletter={{ title: "Newsletter", onSubmit: (e) => api.subscribe(e) }}
  legal={[{ label: "Privacy", href: "/privacy" }]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `brand` | Brand props or node | — | |
| `about` | node | — | short line under the brand |
| `columns` | `{ title, links: { label, href }[] }[]` | — | |
| `social` | `{ label, href, icon }[]` | — | icon links (label is the accessible name) |
| `newsletter` | Newsletter props | — | adds the sign-up form |
| `copyright` | node | `© year name` | |
| `legal` | `{ label, href }[]` | — | bottom links |
| `wordmark` | string | — | big decorative word |
| `toTop` | boolean | `true` | back-to-top button |

## Accessibility

A `<footer>`; each column is a `<nav>` labelled by its title; social links are named by `label`; the wordmark is
decorative (`aria-hidden`). Back to top scrolls smoothly unless reduced motion is on.

## Composed of

Brand, Newsletter, IconButton.
