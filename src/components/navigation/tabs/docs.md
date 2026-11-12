# Tabs

Tabbed panels. Give `tabs` as data or write `<Tab>` children; only the active panel exists (switching disposes the old
one). Arrow keys move between tabs with automatic activation, mirrored in RTL. Tabs can carry a count badge, be
disabled or hidden, and `query="tab"` keeps the active tab in the URL (`?tab=id`) so a reload or a shared link opens it.

```tsx
<Tabs value={$tab} onChange={(id) => $tab = id} tabs={[
  { id: "general", label: "General", content: () => <General /> },
  { id: "members", label: "Members", badge: () => $pending, content: () => <Members /> },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `tabs` | `TabSpec[]` / accessor | — | `{ id, label, badge?, disabled?, hidden?, content? }`; or `<Tab>` children |
| `value` | string / accessor | first tab | controlled active id (`bind:value` works) |
| `onChange` / `setValue` | `(id) => void` | — | called when a tab is chosen |
| `query` | string | — | keep the active tab in this URL query parameter |
| `label` | string | — | accessible name of the tab list |
| `panel` | boolean | `true` | `false` draws only the tab bar (the panel lives elsewhere) |
| `color` | ColorToken | theme primary | accent of the active tab |

## Accessibility

`role="tablist"` with `role="tab"` buttons (`aria-selected`, `aria-controls`) and one `role="tabpanel"` labelled by the
active tab. Only the active tab is a Tab stop; ← → Home End move and activate (mirrored in RTL). Disabled tabs are
skipped.

## Composed of

Badge (tab counts); the roving focus helper.
