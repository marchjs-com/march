# LinkCard

A card that is one link: the entry points of a dashboard or a section page. An icon tile (or your own lead), a title
that never wraps, a description, a small text at the end and an arrow that appears on hover and focus.

```tsx
<LinkCard href="/members" icon={users} title="Members" description="Search and manage" meta="128" />
<LinkCard href="/team" lead={<Avatar name="Running Club" />} color="brand-orange" title="Running Club" arrow={false} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `href` | route / URL | | the whole card is the link (router `Link`: prefetch, active state) |
| `title` | text / node / accessor | | one line; scrolls on hover when it does not fit |
| `description` | text / node / accessor | | |
| `icon` | icon | | drawn in an IconTile |
| `tone` | IconTile tone | `primary` | |
| `color` | color token | | colour of the tile (wins over `tone`) |
| `lead` | node | | own start content instead of the tile |
| `meta` | text / node / accessor | | small text at the end (a count, a status) |
| `arrow` | `boolean` / node | `true` | the hover arrow, or your own mark |
| `class` | class value | | |

Other attributes (`target`, `onClick`, `preload`…) pass to the link.

## Accessibility

One `<a>`: its text (title, description, meta) is the accessible name, the tile and the arrow are decorative. The
focus ring is the link's own; the arrow shows on keyboard focus as on hover and mirrors in right-to-left text. Reduced
motion: no lift, no arrow slide.

## Composed of

IconTile, OverflowText, Link (router).
