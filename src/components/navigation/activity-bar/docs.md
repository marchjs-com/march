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
| `orientation` | `vertical` `horizontal` | `vertical` | |
| `controls` | string | — | id of the side view (`aria-controls`) |
| `label` | string | "Views" | accessible name |

## Accessibility

A tablist (`aria-orientation`) of tabs with names, tooltips and `aria-keyshortcuts`; one tab stop on the active view.
↑ ↓ (or ← →, mirrored in RTL) / Home / End move, Enter / Space choose. Badges are read with the tab.

## Composed of

Badge (counts), Tooltip (names on hover and focus). Roving focus from ui/focus, the indicator on the motion engine.
