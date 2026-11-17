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
| `items` | `ActivityItem[]` / accessor | — | `{ id, label, short, icon, badge, position, shortcut, onSelect }` (`short`: the shorter name under the icon with `showLabels`) |
| `value` | string / null / accessor | — | the active view |
| `onChange` | `(id \| null) => void` | — | |
| `collapsible` | boolean | `true` | choosing the active view again gives `null` |
| `orientation` | `vertical` `horizontal` (or a signal) | `vertical` | live: the same bar turns, the indicator moves to the bottom edge, keys follow the axis |
| `controls` | string | — | id of the side view (`aria-controls`) |
| `label` | string | "Views" | accessible name |
| `indicator` | boolean | `true` | the line that marks the active view |
| `motion` | `glide` `fade` `none` | `glide` | how the indicator moves to a new view |
| `tooltips` | boolean | `true` | name tooltips on hover and focus (the accessible name stays either way) |
| `glass` | boolean / accessor | `false` | frosted glass: see-through, the backdrop blurred, a hairline glass edge (`--m-glass-tint`, `--m-glass-blur`) |
| `subItems`, `subValue`, `onSubSelect` | boolean, id, `(child, parent) => void` | `false` | the selected item's `children` fly out of it and line up under it (another item takes them away and brings its own); `subValue` marks the current one; a child calls `onSubSelect` (default `onChange(child.id)`) |
| `showLabels` | boolean | `false` | the name under each icon (an item's `short`, else its `label`): a wider bar, for a section rail or a phone tab bar |
| `m:color` | ColorToken | theme primary | Common prop (march/props): the colour token of the component and everything in it. |
| `class` | ClassProp | — | extra class on the bar |

```tsx
<ActivityBar items={views} value={$view} onChange={(v) => $view = v} color="brand-purple" motion="fade" tooltips={false} />
<ActivityBar items={views} value={$view} onChange={(v) => $view = v} indicator={false} />
// a section rail with names; the same bar lies down as the tab bar of a phone
<ActivityBar items={sections} value={$section} onChange={pick} showLabels tooltips={false} collapsible={false} orientation={() => (narrow() ? "horizontal" : "vertical")} />
```

## Accessibility

A tablist (`aria-orientation`) of tabs with names, tooltips and `aria-keyshortcuts`; one tab stop on the active view.
↑ ↓ (or ← →, mirrored in RTL) / Home / End move, Enter / Space choose. Badges are read with the tab.

## Composed of

Tabs (its TabList: the vertical tab strip with roving focus and selection), Badge (`size="xs"` counts), Tooltip (names on hover and focus). The indicator is the shared `slidingIndicator` (motion engine).
