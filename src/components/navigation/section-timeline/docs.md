# SectionTimeline

A dot per section of a long page, in a column or a row. The section being read is in full colour, the ones behind it
light, the ones ahead without colour; a press on a dot scrolls to its section. Near the pointer (or the focused dot)
it magnifies like a dock: the dots move apart and swell, their names open beside them, larger the nearer they are.
With `hash` the address follows the section being read, and a shared `#name` opens at that section.

```tsx
<SectionTimeline items={sections} hash fixed intro />
<SectionTimeline items={steps} orientation="horizontal" root={() => box} />
<SectionTimeline items={sections} magnify={false} onChange={(i) => $read = i} />
```

Each item: `{ label, target, slug?, placeholder? }`. `target` is the section (an element, a selector or a getter that
returns null while it is not drawn). `slug` is its `#name` (the dot is then a link). `placeholder` stands in for a
section that is not drawn yet, such as the slot of a lazy part: the timeline scrolls it into view so it loads, then
goes on to the section.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `SectionTimelineItem[]` / accessor | | the sections, in page order |
| `orientation` | `vertical` `horizontal` | `vertical` | a column of dots or a row |
| `axis` | `y` `x` | `y` | the way the page (or `root`) scrolls; either orientation works with either axis |
| `fixed` | `boolean` | `false` | at the edge of the screen: the end side (vertical) or the bottom (horizontal) |
| `root` | element / getter | the page | the box that scrolls |
| `magnify` | `boolean` / accessor | `true` | the dock magnifier |
| `reach` | `number` / accessor | `130` | how far the magnifier reaches, px |
| `grow` | `number` / accessor | `28` | room a fully magnified dot takes beyond its step, px |
| `intro` | `boolean` | `false` | when the reader first reaches the first section, the magnifier sweeps once from the first dot to the last, so a newcomer sees the names; not before (the page's own opening is left alone), not under reduced motion, the pointer takes over |
| `wave` | `number` / `false` | `480` | when the section being read changes, the dots between the old and the new one take their colour one after another: the wave's length in ms |
| `hash` | `boolean` | `false` | the section being read writes `#slug` into the address (no history entry); an address naming a section opens there |
| `offset` | `number` / accessor | `80` | room kept before a section scrolled to (a sticky top bar) |
| `line` | `number` / accessor | `0.33` | the reading line, a share of the box: a section counts as read once its start passes it |
| `smooth` | `boolean` / accessor | `true` | smooth scrolling to a pressed section (off with reduced motion) |
| `onChange` | `(index) => void` | | the section being read changed (-1 before the first) |
| `labels` | `{ group? }` | "Sections" (translated) | accessible name |
| `label` | `(item, index) => node` | the item's label | own content of a name |
| `m:color` | color token | accent | Common prop (march/props): the colour of the dots. |
| `class` | class value | | |

CSS tokens: `--m-stl-step` (room per dot), `--m-stl-c` (colour), `--m-stl-past` (the sections behind).

## Accessibility

A `nav` named "Sections" with a list of links (with `slug`) or buttons. The section being read has
`aria-current="location"` and is the one tab stop; the arrow keys move between the dots (Left and Right swap in
right-to-left), Home and End go to the first and the last. Focusing a dot magnifies around it and shows its name.
Under reduced motion the magnifier comes and goes at once and scrolling is not smooth.

## Performance

The magnifier changes no size: the dots move and scale (transforms), so a frame of it lays out nothing. It draws once a
frame and writes only the values that changed. A fixed timeline is closed to the page (`contain: strict`).
