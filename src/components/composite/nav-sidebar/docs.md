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
| `floating` | boolean / accessor | `false` | wide screens: a card off the screen edge, as tall as its content (at most the room between the gaps, then it scrolls) (gap `--m-sb-gap`, a larger top gap `--m-sb-gap-top` under a floating header, corners `--m-sb-radius`, a shadow) |
| `glass` | boolean / accessor | `false` | frosted glass: see-through, the backdrop blurred, a hairline glass edge (`--m-glass-tint`, `--m-glass-blur`) |
| `subMenus` | `"inline"` / `"flyout"` | `"inline"` | the pages under an item: in the list under it, or (wide screens) floating in a panel beside it while the pointer is over it (its arrow or → opens it too; ← goes back); the list never moves |
| `pinCurrent` | boolean / accessor | `false` | with `subMenus: "flyout"`: the current page's branch is pinned in the list (its pages and those of the items above it open in the list, which grows); the other items still fly out |
| `resizable`, `minWidth`, `maxWidth`, `collapseBelow` | boolean, px | `false`, 200, 480 | drag grip; narrower than `collapseBelow` switches to the rail |
| `storageKey`, `persist` | string, boolean | `"m.sidebar"` | where open categories, recents and width are kept |
| `placeholder`, `label` | string | `t` texts | search placeholder, landmark name |
| `search` | boolean | `true` | the search box (`false` also drops its shortcut) |
| `headings` | boolean | `true` | the "Recent" and "Categories" headings |
| `expandAll` | boolean | `true` | the "Expand all / Collapse all" button |
| `groupCounts` | boolean | `true` | the item count beside each category name |
| `groupHeads` | boolean | `true` | the category rows; `false`: a two-level menu (the items of the listed categories in one list, in category order, without the category names); "Expand all / Collapse all" then opens and closes the items with pages under them |
| `nestedSubs` | boolean | `false` | nested items (a page under a page) show their `sub` line too |
| `visibleGroups` | `string[]` (reactive) | — | only these categories are listed: one section of a large menu at a time. The other items stay in the search, the recent list and the palette; "Collapse all" then touches only the listed ones |
| `itemSize` | `"md"` `"lg"` | `"md"` | `lg`: top-level rows are equal, roomy rows (`--m-sb-item-h`, 3.625rem): the icon in a tinted tile, one line of description, the number of pages under the row; nested rows are text only |
| `subOverflow` | `"scroll"` `"marquee"` `"ellipsis"` | `"scroll"` | a row's text that does not fit: loops with a rest on hover / focus / the current row; `marquee` flows one way without a rest while the row is hovered, focused, current or open (never with reduced motion; text that fits stays still); `ellipsis` cuts it |
| `sheetSide` | `"start"` `"end"` `"bottom"` | `"start"` | narrow screens: the edge the drawer comes from (`bottom`: a bottom sheet) |
| `menuButton` | boolean | `true` | the menu button of narrow screens; `false`: open the drawer yourself with `open` |
| `open`, `onOpenChange` | boolean (reactive), `(open) => void` | — | narrow screens: the drawer, controlled (a bottom bar opens it) |
| `labels` | object | `t` texts | `search`, `clearSearch`, `noMatches`, `results`, `recent`, `categories`, `expandAll`, `collapseAll`, `menu`, `expandSidebar`, `collapseSidebar`, `resize` (strings or accessors), `showUnder(label)`, `hideUnder(label)` |
| `width`, `onResize` | px / CSS length, `(px) => void` | 17.5rem | starting width; called while resizing |
| `groupIcons` | `{ [group]: icon }` | — | icons beside category names |
| `shortcut`, `palette` | string, boolean | `"mod+k"`, `true` | the search shortcut; `false` keeps the items out of the command palette |
| `class` | class | — | on the wrapper (`m-sb-wrap`); parts: `m-sb-head`, `-title`, `-search`, `-section`, `-all`, `-group`, `-gbtn`, `-count`, `-item`, `-badge`, `-foot`, `-resize` |

```tsx
<NavSidebar items={items} search={false} headings={false} groupCounts={false} />     // a plain list of categories
<NavSidebar items={items} labels={{ recent: "Last opened", categories: "Sections", expandAll: "Open all", noMatches: "Nothing here" }} />
```

### A section rail beside the menu

A large menu can show one section at a time: a rail (ActivityBar) picks the section, `visibleGroups` lists its
categories. On a phone the rail becomes the bottom bar and opens the menu as a bottom sheet.

```tsx
<ActivityBar items={sections} value={$section} onChange={(id) => { $section = id; if (narrow()) $sheet = true }} showLabels tooltips={false} collapsible={false} />
<NavSidebar items={items} title={() => current().label} visibleGroups={() => current().groups} search={false}
  itemSize="lg" subOverflow="marquee" resizable minWidth={220} maxWidth={460}
  sheetSide="bottom" menuButton={false} open={() => $sheet} onOpenChange={(o) => $sheet = o} />
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
Empty (no matches), ResizeHandle (the width grip), Drawer (the narrow-screen menu: loaded on the first open,
shared with NavMenu through `navigation/nav-menu/drawer.ts`).
