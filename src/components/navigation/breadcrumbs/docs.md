# Breadcrumbs

A path bar (folder › file › symbol). A crumb is a link (`href`), a button (`onSelect`) or, with `siblings`, a menu of
the items beside it — jump to another file of the same folder. When the path does not fit, the middle crumbs collapse
into a "…" menu; the first and the last always stay. Separators follow the reading direction.

```tsx
<Breadcrumbs label="File path" items={[
  { id: "hadi", label: "hadi", icon: folder, onSelect: () => openFolder("hadi") },
  { id: "src", label: "src", icon: folder, siblings: () => folders("hadi") },
  { id: "file", label: "app.ts", icon: fileText },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `Crumb[]` / accessor | — | `{ id, label, icon, href, onSelect, siblings }`; a sibling is `{ id, label, icon, sub, href, onSelect, current }` |
| `label` | string | "Path" | accessible name of the nav |
| `separator` | icon / short text / `() => node` / `false` | chevron | what stands between the crumbs; `false`: nothing |
| `collapse` | boolean | `true` | collapse the middle into the "…" menu when narrow; `false`: the path is clipped instead |
| `ellipsis` | node | "…" | content of the collapsed-crumbs trigger |
| `labels` | `{ more?, goTo?: (name) => string }` | "Hidden path parts", "name: go to" | accessible names of the "…" menu and of a sibling menu |
| `class` | ClassProp | — | extra class on the nav |

```tsx
<Breadcrumbs items={path} separator="/" ellipsis="···" labels={{ more: "Folders in between", goTo: (name) => `Open next to ${name}` }} />
<Breadcrumbs items={path} separator={false} collapse={false} />
```

A sibling with `href` is a link (the router's Link: a middle click or "open in new tab" works), one with `onSelect`
a button. `current: true` marks the sibling the path goes through (tinted; the link of the open page has
`aria-current="page"` from the router), `sub` adds a quieter second line.

```tsx
<Breadcrumbs separator="/" items={[
  { id: "home", label: "MarchJS", href: "/" },
  { id: "forms", label: "Forms", siblings: sections.map((s) => ({ id: s.path, label: s.title, sub: s.desc, icon: s.icon, href: s.path, current: s.path === "/forms" })) },
  { id: "select", label: "Select", siblings: pagesOf("/forms").map((p) => ({ id: p.path, label: p.title, href: p.path, current: p.path === here })) },
]} />
```

## Accessibility

`nav` with a name around an ordered list; the last crumb has `aria-current="page"`. Separators are hidden from
assistive technology. Crumbs with siblings are menu buttons (`aria-haspopup="menu"`, arrows, Esc). Collapsed crumbs
are items of the "…" menu.

## Composed of

Button (a link or button crumb), Menu (sibling menus and the … menu), OverflowText (a long name). Fitting from ui/fit.
