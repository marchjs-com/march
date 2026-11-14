# Hero

The first screen of a website in seven looks that share one structure: an eyebrow pill, a large title whose
`highlight` gets the brand gradient, a lead, actions and a note. The stage changes by variant: `centered` (soft grid
and spotlight), `split` (media at the end), `video` (VideoBackground), `mesh` (gradient mesh, spotlight, grain),
`aurora` (drifting colour), `product` (a product frame that tilts in 3D and flattens as you scroll) and `parallax`
(layered depth).

```tsx
<Hero variant="mesh" eyebrow="New: 2.0" title="The fastest way to build a website" highlight="fastest"
  lead="…" note="No card needed" actions={[{ label: "Start free", href: "/start", iconEnd: arrowRight }, { label: "Watch demo" }]} />
<Hero variant="product" media={{ src: "/screen.png", alt: "Dashboard", width: 1600, height: 1000 }} … />
<Hero variant="video" video={{ src: "/clip.webm", poster: "/clip.jpg" }} … />
<Hero variant="mesh" title="…" backdrop={false} reveal="none" />              // no decorative layers, no entrance
<Hero variant="product" title="…" media={…} frameBar={false} tilt={false} reveal="blur" />
<Hero eyebrow="New" eyebrowHref="/news" eyebrowArrow={<Icon of={arrowRight} />} title="…"
  reveal={{ from: { opacity: 0, transform: "scale(.9)" }, to: { opacity: 1, transform: "scale(1)" } }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `variant` | `centered` `split` `video` `mesh` `aurora` `product` `parallax` | `centered` | |
| `eyebrow`, `eyebrowHref` | node, string | — | pill above the title (a link with `eyebrowHref`) |
| `title`, `highlight` | node, string | — | `highlight`: part of a string title in the brand gradient |
| `lead`, `note` | node | — | |
| `actions` | `{ label, href?, onClick?, variant?, icon?, iconEnd? }[]` or nodes | — | the first is primary |
| `media` | `{ src, alt, width, height, srcset?, sizes? }` or a node | — | split / product |
| `video` | `{ src, poster? }` | — | video variant |
| `layers` | Parallax layers | — | parallax variant |
| `colors` | string[] | HADİ colours | aurora variant |
| `align` | `center` `start` | by variant | |
| `size` | `md` `lg` `screen` | `lg` | minimum height |
| `level` | 1 2 | 1 | heading level of the title (2 when the hero is not the page's top) |
| `eyebrowArrow` | boolean / node | `true` | the arrow after a linked eyebrow, or your own |
| `backdrop` | boolean | `true` | the decorative layers of the variant (grid, mesh, aurora, dots, pointer light, grain) |
| `reveal` | Reveal effect / `{ from, to }` / `none` | `up` | entrance of the copy (and of the split media; `none` switches both off) |
| `frameBar` | boolean | `true` | product: the window bar with three dots |
| `tilt` | boolean | `true` | product: the frame starts tilted and flattens with the scroll |
| `class` | string | — | extra class on the section (`.hm-hero`; parts: `.hm-hero-copy` (a SectionHead: `.hm-section-head-eyebrow`, `-title`, `-lead`, `-actions`, `-note`), `.hm-hero-hl`, `.hm-hero-frame`) |
| children | node | — | extra content under the note |

## Accessibility

One `<h1>` (the title). Decorative layers are inert and hidden from screen readers; the video has a pause button. Hero
images load eagerly with `fetchpriority="high"` and a reserved size (no layout shift). Reduced motion keeps the product
frame flat and the layers still.

## Composed of

SectionHead (the copy, with Reveal), Badge, Picture, Reveal, Overlay, Aurora (hadi-march/fx), VideoBackground, Parallax; `scrollTimeline` (motion scroll core).
