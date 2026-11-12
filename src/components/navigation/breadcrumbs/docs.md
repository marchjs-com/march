# Breadcrumbs

A path bar (folder › file › symbol). A crumb is a link (`href`), a button (`onSelect`) or, with `siblings`, a menu of
the items beside it — jump to another file of the same folder. When the path does not fit, the middle crumbs collapse
into a "…" menu; the first and the last always stay. Separators follow the reading direction.

```tsx
<Breadcrumbs label="File path" items={[
  { id: "acme", label: "acme", icon: folder, onSelect: () => openFolder("acme") },
  { id: "src", label: "src", icon: folder, siblings: () => folders("acme") },
  { id: "file", label: "app.ts", icon: fileText },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `Crumb[]` / accessor | — | `{ id, label, icon, href, onSelect, siblings }` |
| `label` | string | "Path" | accessible name of the nav |

## Accessibility

`nav` with a name around an ordered list; the last crumb has `aria-current="page"`. Separators are hidden from
assistive technology. Crumbs with siblings are menu buttons (`aria-haspopup="menu"`, arrows, Esc). Collapsed crumbs
are items of the "…" menu.

## Composed of

Menu (sibling menus and the … menu). Fitting from ui/fit.
