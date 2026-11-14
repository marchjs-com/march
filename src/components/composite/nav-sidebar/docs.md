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
| `search` | boolean | `true` | the search box (`false` also drops its shortcut) |
| `headings` | boolean | `true` | the "Recent" and "Categories" headings |
| `expandAll` | boolean | `true` | the "Expand all / Collapse all" button |
| `groupCounts` | boolean | `true` | the item count beside each category name |
| `nestedSubs` | boolean | `false` | nested items (a page under a page) show their `sub` line too |
| `labels` | object | `t` texts | `search`, `clearSearch`, `noMatches`, `results`, `recent`, `categories`, `expandAll`, `collapseAll`, `menu`, `expandSidebar`, `collapseSidebar`, `resize` (strings or accessors), `showUnder(label)`, `hideUnder(label)` |
| `width`, `onResize` | px / CSS length, `(px) => void` | 17.5rem | starting width; called while resizing |
| `groupIcons` | `{ [group]: icon }` | — | icons beside category names |
| `shortcut`, `palette` | string, boolean | `"mod+k"`, `true` | the search shortcut; `false` keeps the items out of the command palette |
| `class` | class | — | on the wrapper (`hm-sb-wrap`); parts: `hm-sb-head`, `-title`, `-search`, `-section`, `-all`, `-group`, `-gbtn`, `-count`, `-item`, `-badge`, `-foot`, `-resize` |

```tsx
<NavSidebar items={items} search={false} headings={false} groupCounts={false} />     // a plain list of categories
<NavSidebar items={items} labels={{ recent: "Last opened", categories: "Sections", expandAll: "Open all", noMatches: "Nothing here" }} />
```

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

ListRow (every row: icon, label, sub line, badge; a router link that marks the current page; long labels scroll),
SearchBox (the search field with its clear button and shortcut hint), PanelHeader (title bar), SectionLabel (headings),
IconButton (menu, rail and fold buttons), Button (expand / collapse all), Badge (counts), Chevron (the turning arrows),
Empty (no matches), ResizeHandle (the width grip).
