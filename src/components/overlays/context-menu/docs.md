# ContextMenu

The menu that opens where you right-click, or with Shift+F10 / the Menu key on the focused element. It draws the same
items as `Menu` — plain items, actions, separators, shortcuts — with the same roving keyboard; `items` receives the
element that was clicked, so one menu can offer different entries for different targets.

```tsx
<ContextMenu items={(target) => [{ label: "Copy", shortcut: "mod+c", onSelect: copy }, "-", { label: "Delete", danger: true, onSelect: remove }]}>
  <ul class="files">…</ul>
</ContextMenu>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `(target, point) => MenuItem[]` | — | entries for this opening |
| `when` | `(target) => boolean` | — | return false to keep the browser menu |
| `label` | string | — | accessible name of the menu |
| `menuClass` | ClassProp | — | extra class on the floating menu panel (`.m-menu`) |
| `class` | ClassProp | — | extra class on the host around the children (it adds no box: `display: contents`) |
| `children` | node | — | the area that answers the right-click |

Every text, icon, shortcut and colour of the menu comes from your `items` (the `MenuItem` of `Menu`), so there is
nothing built in to replace: `<ContextMenu items={items} menuClass="files-menu" label="File actions">…</ContextMenu>`.

## Accessibility

The panel is a `menu` of `menuitem`s; the first item takes focus, ↑ ↓ Home End move, Enter runs, Escape closes and
returns focus to where it was. Shift+F10 and the Menu key open it at the focused element, so it never needs a pointer.

## Composed of

Menu (`menuPanel()`: the same panel, entries and keys), which is a Popover (floating panel, positioning, Portal layer).
