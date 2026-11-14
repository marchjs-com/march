# ActivityBar

The narrow icon bar at the edge of an editor that switches the side view (files, search, source control…). An
indicator glides to the active view; choosing the active view again collapses the side view (`value` becomes `null`).
Items can carry count badges, sit at the far end (settings, account) or be plain actions. Vertical or horizontal (a
bottom bar on phones), and mirrored in RTL.

```tsx
<ActivityBar value={$view} onChange={(v) => $view = v} controls="side-view" items={[
  { id: "files", label: "Files", icon: files, shortcut: "mod+shift+e" },
  { id: "search", label: "Search", icon: search, badge: () => $hits },
  { id: "settings", label: "Settings", icon: settings, position: "end", onSelect: openSettings },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `ActivityItem[]` / accessor | — | `{ id, label, icon, badge, position, shortcut, onSelect }` |
| `value` | string / null / accessor | — | the active view |
| `onChange` | `(id \| null) => void` | — | |
| `collapsible` | boolean | `true` | choosing the active view again gives `null` |
| `orientation` | `vertical` `horizontal` (or a signal) | `vertical` | live: the same bar turns, the indicator moves to the bottom edge, keys follow the axis |
| `controls` | string | — | id of the side view (`aria-controls`) |
| `label` | string | "Views" | accessible name |
| `indicator` | boolean | `true` | the line that marks the active view |
| `motion` | `glide` `fade` `none` | `glide` | how the indicator moves to a new view |
| `tooltips` | boolean | `true` | name tooltips on hover and focus (the accessible name stays either way) |
| `color` | ColorToken | theme primary | colour of the active view and the indicator |
| `class` | ClassProp | — | extra class on the bar |

```tsx
<ActivityBar items={views} value={$view} onChange={(v) => $view = v} color="brand-purple" motion="fade" tooltips={false} />
<ActivityBar items={views} value={$view} onChange={(v) => $view = v} indicator={false} />
```

## Accessibility

A tablist (`aria-orientation`) of tabs with names, tooltips and `aria-keyshortcuts`; one tab stop on the active view.
↑ ↓ (or ← →, mirrored in RTL) / Home / End move, Enter / Space choose. Badges are read with the tab.

## Composed of

Tabs (its TabList: the vertical tab strip with roving focus and selection), Badge (`size="xs"` counts), Tooltip (names on hover and focus). The indicator is the shared `slidingIndicator` (motion engine).
