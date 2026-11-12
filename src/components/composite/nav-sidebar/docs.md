# NavSidebar

The app's side menu: categories that open and close, a typo-tolerant search over every item, recent visits and
featured items at the top, a collapsible icon rail and a resizable width, all remembered per user. Items are links
(router `Link`), so the current page is marked and the menu follows navigation.

```tsx
<NavSidebar title="HADİ" items={[
  { id: "/orders", label: "Orders", href: "/orders", group: "Sales", icon: cart, badge: () => $open },
  { id: "/users", label: "Users", href: "/users", group: "Admin", can: "users.read" },
]} collapsible resizable groupOrder={["Sales", "Admin"]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `NavSidebarItem[]` (reactive) | — | `id`, `label`, `href` or `onSelect`, `group`, `icon`, `sub`, `badge`, `can`, `keywords` |
| `title`, `subtitle`, `footer` | node | — | header and footer |
| `featured` | `NavSidebarItem[]` | — | highlighted items above the categories |
| `recent` | number | `5` | recent visits shown (0 = off) |
| `groupOrder` | `"alpha"` `"none"` `string[]` | `"alpha"` | category order; names first, the rest after |
| `itemOrder` | `"alpha"` `"none"` | `"alpha"` | order inside a category |
| `defaultOpen` | `"active"` `"all"` `"none"` | `"active"` | categories open on the first visit |
| `hotkey` | `"focus"` `"palette"` `false` | `"focus"` | Ctrl+K focuses the search, or belongs to a CommandPalette |
| `collapsible` | boolean | `false` | icon rail button (state persists) |
| `resizable`, `minWidth`, `maxWidth`, `collapseBelow` | boolean, px | `false`, 200, 480 | drag grip; narrower than `collapseBelow` switches to the rail |
| `storageKey`, `persist` | string, boolean | `"hm.sidebar"` | where open categories, recents and width are kept |
| `placeholder`, `label` | string | `t` texts | search placeholder, landmark name |

### Nested items

An item with `parent: "<id>"` is listed indented under that item, in a fold of its own with a chevron at the end of the
parent row. The fold opens by itself while the parent or one of its children is the current page; the chevron (or → / ←
on the focused row) opens and closes it, and the choice is remembered. The group count counts top-level items.

```ts
{ id: "/editors", label: "Editörler", href: "/editors", group: "Formlar" },
{ id: "/editors/terminal", label: "Terminal", href: "/editors/terminal", group: "Formlar", parent: "/editors" },
```

## Accessibility

A `nav` landmark with a `search` region; category buttons carry `aria-expanded` and `aria-controls`, the current page
`aria-current="page"`. The resize grip is a focusable `separator` with `aria-valuenow` (← → Home End, double click
resets). On narrow screens the menu becomes a drawer behind a burger button (`aria-expanded`, Escape closes). Long
labels scroll with OverflowText instead of being cut.

## Composed of

OverflowText (long labels and sub lines), Link (router links that mark the current page).
