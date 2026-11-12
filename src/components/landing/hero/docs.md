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

## Accessibility

One `<h1>` (the title). Decorative layers are inert and hidden from screen readers; the video has a pause button. Hero
images load eagerly with `fetchpriority="high"` and a reserved size (no layout shift). Reduced motion keeps the product
frame flat and the layers still.

## Composed of

Reveal, Overlay, Button, Badge, Aurora (hadi-march/fx), VideoBackground, Parallax; `scrollScene`.
