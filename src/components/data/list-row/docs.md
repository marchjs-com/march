# ListRow

The row lists are made of: a lead (icon, avatar, dot, thumbnail), a title, a sub text and a trail (badge, shortcut,
arrow, meta). It is a link with `href`, a button with `onClick`, or a plain element that takes any role, so menus,
sidebars, command palettes, trees and file lists all build their rows from it.

```tsx
<ListRow lead={home} title="Home" sub="Overview" trail={<Badge count={3} />} href="/" active />
<ListRow lead={<Avatar name="Deniz Kaya" size="sm" decorative />} title="Deniz Kaya" sub="online" onClick={open} />
<ListRow as="li" role="option" aria-selected={on} interactive active={on} title={cmd.title} trail={<Kbd keys="mod+k" />} />
<ListRow title={file.name} sub="2.4 MB" actions={<IconButton icon={trash} label="Remove" onClick={remove} />} />
<ListRow as="article" direction="column" overflow="wrap" lead={<IconTile icon={zap} />} title="Fast" titleAs="h3" sub="Every route is a lazy chunk." subAs="p" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `lead` | icon / text / node | — | lead slot: an icon, an emoji, an Avatar, a StatusDot, an image |
| `title` | text / node / accessor | children | main line; plain text scrolls when it does not fit |
| `sub` | text / node / accessor | — | second line |
| `trail` | node | — | inside the row: Badge, Kbd, Chevron, a time |
| `actions` | node | — | controls for the row; beside a link / button row, at the end of a plain row |
| `href` | string | — | makes it a link |
| `onClick` | function | — | makes it a button (with `as`: a click listener on that element) |
| `as` | `div` `li` `span` `label` `button` `article` | `div` | element of a row that is not a link or a button; `button`: a button whose host adds its own listeners (drag, keys) instead of `onClick` |
| `titleAs` | `h2`…`h6` `p` `div` `span` | `span` | element of the title; a heading wraps instead of scrolling |
| `subAs` | `p` `div` `span` | `span` | element of the sub text |
| `direction` | `row` `column` | `row` | `column`: a tile, lead above the text (`align="center"` centres it) |
| `active` | boolean / accessor | `false` | the current row; a link gets `aria-current="page"` |
| `selected` | boolean / accessor | — | a chosen row; `aria-pressed` on a button, `aria-checked` / `aria-selected` with a matching `role` |
| `disabled` | boolean / accessor | `false` | |
| `interactive` | boolean | `false` | hover look for a plain row whose host handles the click |
| `size` | `xs` `sm` `md` `lg` | `md` | `xs`: a status bar item, a dense strip |
| `color` | color token | accent | tint of the active / selected row |
| `align` | `center` `start` | `center` | where lead and trail sit beside tall text |
| `overflow` | `scroll` `ellipsis` `wrap` | `scroll` | text that does not fit |
| `marquee` | OverflowText options | — | `{ mode: "loop" }` … for the scrolling text |
| `indicator` | boolean | `false` | bar at the start edge of the active row |
| `tooltip` | string | — | native tooltip (the HTML `title` attribute) |
| `class` | class | — | |
| other attributes | | | `role`, `aria-*`, `tabindex`, `data-*`, `id`, `ref`, listeners go to the row element |

## Accessibility

The row is a real `<a>` or `<button>` when it navigates or acts; controls in `actions` are placed beside it, never
inside. A plain row takes the role its list needs (`option`, `menuitem`, `treeitem`, `radio` …) with `tabindex` and
`ref` for roving focus; keyboard handling belongs to the host list (Listbox, Menu, Tree). `selected` is announced by
the attribute that fits the role; `disabled` disables a button and sets `aria-disabled` elsewhere, and its click does
nothing. The focus ring is drawn inside the row. Scrolling text is read once and stops under reduced motion.

## Composed of

OverflowText (titles and sub texts that do not fit).

## Light form

`PlainListRow` (`src/components/data/list-row/core.ts`, internal) is the same row without the scrolling text: light
components (Accordion header, Menu entry, Toast, StatusBar item) build on it so they never load OverflowText;
`overflow="scroll"` is cut like `"ellipsis"` there.
