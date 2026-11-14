# NavMenu

Sidebar navigation for big apps. Items are grouped (collapsible groups with icons), can be pinned, and the recently
used ones are listed first; a filter box narrows the list with accent- and case-insensitive search. The active item
follows the router path, and the pages are registered with the command palette. On narrow screens the menu becomes a
drawer opened by a menu button; `collapsible` adds an icon rail on wide screens. UI state persists in localStorage.
NavSidebar is the richer sidebar built on the same container.

```tsx
<NavMenu brand={<Brand />} items={[
  { id: "inbox", title: "Inbox", href: "/inbox", icon: inbox, badge: () => $unread },
  { id: "users", title: "Users", href: "/users", icon: users, group: "Admin" },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `NavItem[]` / accessor | — | `{ id, title, href, icon?, group?, badge?, keywords?, can?, hidden? }` |
| `brand` / `footer` | node | — | top and bottom slots |
| `filter` | boolean | `true` | show the filter box |
| `collapsible` | boolean | `false` | icon rail button on wide screens |
| `groupsCollapsed` | boolean | `false` | groups start closed; the active page's group opens |
| `groupIcons` | `{ [group]: icon }` | — | group heading icons (also the items' default icon) |
| `sort` | `"alpha"` / `"none"` / fn | `"alpha"` | item order within a group |
| `maxPinned` / `maxRecent` | number | `8` / `5` | list sizes; `maxRecent={0}`: no Recent block |
| `pins` | boolean | `true` | the pin (star) button of every item and the Pinned block |
| `icons` | `{ menu?, pin?, pinned?, chevron?, search?, rail? }` | built-in | own icon per built-in part (IconDef, short string or node); `chevron: false` / `search: false` drop that mark |
| `labels` | `{ filter?, filterPlaceholder?, noMatches?, pinned?, recent?, menu?, expandSidebar?, collapseSidebar?, pin?: (title) => string, unpin?: (title) => string }` | translated defaults | own texts (strings or accessors) |
| `label` | string | "Main" | accessible name of the nav |
| `class` | ClassProp | — | extra class on the wrapper |
| `palette` | boolean | `true` | register the pages with the command palette |
| `storageKey` | string | `"hm.nav"` | localStorage key for pins, recents, groups |

```tsx
<NavMenu items={items} pins={false} maxRecent={0} icons={{ chevron: plus, search: false }}
  labels={{ filterPlaceholder: "Find a page…", noMatches: "Nothing here", menu: "Open navigation" }} />
```

## Accessibility

A `<nav>` landmark with a label; the active link has `aria-current="page"`; group headers are buttons with
`aria-expanded`; the filter is a labelled search box. The narrow-screen drawer is opened by a labelled menu button and
closes with Escape or the scrim.

## Composed of

Badge (item counts), OverflowText (long labels scroll on hover); the router, fold search and storage helpers.
