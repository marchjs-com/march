# SiteNav

The top bar of a website. Sticky; `transparent` starts see-through over a hero and turns to glass after a few pixels
of scroll; `floating` is a centred glass pill; `shrink` lowers it once scrolled; `hide` slides it away while scrolling
down and back when scrolling up. A pill slides under the hovered link (mirrored in RTL) and rests on the current one.
Below 860 px the links move into a Drawer.

```tsx
<SiteNav mode="transparent" brand={{ name: "HADİ", mark: logo, href: "/" }}
  links={[{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing", active: () => $section === "pricing" }]}
  actions={<><Button variant="ghost">Sign in</Button><Button>Start</Button></>} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `brand` | Brand props, a name or a node | — | start of the bar |
| `links` | `{ label, href, active? }[]` | — | `active` marks the current page (`aria-current`) |
| `actions` | node | — | end of the bar; also in the drawer |
| `mode` | `solid` `transparent` `floating` | `solid` | |
| `shrink` | boolean | `true` | lower once scrolled |
| `hide` | boolean | `false` | hide while scrolling down |
| `threshold` | px | `12` | scroll that counts as scrolled |
| `source` | Element \| () => Element | the page | the scrolling element `shrink`, `hide` and `transparent` follow |
| `sticky` | boolean | `true` | |
| `onNavigate` | `(href) => void` | — | link chosen |
| `pill` | boolean | `true` | the pill under the hovered / current link |
| `pillColor` | color token | soft neutral | colour of the pill |
| `menu` | boolean | `true` | the menu button of narrow screens |
| `menuIcon` | icon / node | three lines | icon of the menu button |
| `drawerSide` | `left` `right` | `right` | side the drawer opens from |
| `labels` | `{ main?, openMenu?, menu? }` | `Main` `Open menu` `Menu` | name of the navigation, of the menu button, title of the drawer |
| `class` | class | — | on the header |

```tsx
<SiteNav brand={brand} links={links} pillColor="brand-orange" menuIcon={grid} drawerSide="left"
  labels={{ main: "Site", openMenu: "Show the menu", menu: "Pages" }} />
<SiteNav brand={brand} links={links} pill={false} menu={false} />
```

Set `--m-site-nav-top` when the page already has a sticky bar above it. In-page links (`#pricing`) scroll to their section
themselves, so they also work under a hash router; give sections a `scroll-margin-top` for the bar.

## Accessibility

A `<header>` with a `<nav aria-label="Main">`; the current link has `aria-current="page"`. The menu button is labelled
("Open menu") and opens a Drawer (focus trapped, Escape closes). The pill follows keyboard focus too.

## Composed of

Brand, IconButton, openDrawer (Drawer); `slidingIndicator` (the pill), `onScrollProgress` (motion scroll core).
