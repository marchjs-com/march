# SectionHead

The heading group of a page section: a small eyebrow, the title, a lead paragraph, the actions and a note, stacked
and aligned as one block. Every part is optional; the title level, the scale and the alignment are yours, and the
block can enter with Reveal when it scrolls into view.

```tsx
<SectionHead eyebrow="Features" title="Everything you need" lead="Components, theme, motion and speed in one kit." />
<SectionHead size="lg" title="Ready to build?" lead="Start in a minute."
  actions={[{ label: "Start free", href: "/start" }, { label: "Read the docs", href: "/docs" }]} note="No card needed" />
<SectionHead as="h1" size="xl" align="start" eyebrow={<Badge tone="primary">New</Badge>} eyebrowHref="/news"
  title={<>Build <em>faster</em></>} reveal />
<SectionHead as="h3" size="sm" align="start" title="Newsletter" lead="One mail a month." />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `eyebrow` | text / node / accessor | — | text: uppercase in the accent colour; a node (Badge, pill) is shown as it is |
| `eyebrowHref` | string | — | makes the eyebrow a link |
| `title` | node / accessor | — | |
| `as` | `h1`–`h6` | `h2` | heading element of the title |
| `titleId` | string | — | id of the title (the section's `aria-labelledby`) |
| `lead` | node / accessor | — | paragraph under the title |
| `actions` | `(SectionAction \| Node)[]` / node | — | `{ label, href, onClick, variant, icon, iconEnd }`: the first is primary |
| `note` | node / accessor | — | small text under the actions |
| `children` | node | — | more content under the note |
| `align` | `start` `center` `end` | `center` | |
| `size` | `sm` `md` `lg` `xl` | `md` | scale of the title: card · section · call to action · hero |
| `width` | `text` `full` | `text` | a readable measure, or the whole row |
| `m:color` | color token | accent | Common prop (march/props): the colour token of the component and everything in it. |
| `reveal` | boolean / Reveal options | `false` | entrance on scroll: `true` = parts rise one after another |
| `class` | class value | — | |

`sectionActions(actions, size)` returns the buttons alone, for a block that places them elsewhere.

## Accessibility

The title is a real heading: pick the level that fits the page outline with `as` (one `h1` per page), and name the
section with `titleId` + `aria-labelledby`. The eyebrow is a paragraph (or a link with `eyebrowHref`), not a heading.
Uppercase is CSS only. The entrance honours reduced motion (Reveal shows the content at once).

## Composed of

Button (actions), Reveal (the optional entrance).
