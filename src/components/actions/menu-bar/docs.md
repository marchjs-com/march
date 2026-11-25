# MenuBar

An application menu bar: File, Edit, View… along the top of an editor. Every entry is a Menu entry (`label`,
`onSelect`, `icon`, `shortcut`, `checked` / `radio`, `disabled`, `hidden`, `danger`, an `action()`, or a separator
`"-"`); an entry with `items` opens a **submenu**, as deep as you need. The panels are Menu's shared panel, so entries
look and behave exactly like a Menu's.

```tsx
<MenuBar menus={[
  { label: "File", items: [{ label: "New…", shortcut: "mod+n", onSelect: create }, "-", { label: "Export", items: [
    { label: "PNG", onSelect: () => save("png") }, { label: "JPEG", onSelect: () => save("jpeg") },
  ] }] },
  { label: "View", items: [{ label: "Rulers", checked: () => $rulers, onSelect: () => { $rulers = !$rulers } }] },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `menus` | `MenuBarMenu[]` / accessor | — | `{ label, items, hidden, id }`; items are Menu entries or `{ label, items, icon, disabled, hidden }` submenus |
| `args` | array / accessor | — | passed to actions and `onSelect` |
| `label` | string | "Menu bar" | accessible name |
| `mnemonics` | boolean | `true` | Alt + the first letter of a menu opens it |
| `hoverDelay` | number | `120` | ms before a hovered submenu opens |
| `motion` | `"scale"` \| `"fade"` \| `"rise"` \| `"none"` | `"scale"` | the panels' entrance |
| `size` | `"sm"` \| `"md"` | `"sm"` | the bar's buttons |
| `class` | class | — | on the root (`.m-menubar`); parts `.m-menubar-item`, `.m-menubar-panel`, `.m-menubar-sub` |

## Keyboard

| Key | |
|---|---|
| ← → (bar) | previous / next menu (mirrored right to left) |
| ↓ Enter Space (bar) | open the menu on its first entry; ↑ on its last |
| ↑ ↓ Home End (panel) | move between entries |
| → (on a submenu entry) | open the submenu; ← closes it |
| ← → (top panel) | the menu beside it |
| Esc | close one level and return focus |
| Alt + letter | open the menu starting with that letter |

## Accessibility

`role="menubar"` with `menuitem` buttons (`aria-haspopup`, `aria-expanded`, `aria-controls`); one Tab stop (roving);
submenu entries are `menuitem`s with `aria-haspopup="menu"`. Entries keep Menu's roles (`menuitemcheckbox`,
`menuitemradio`) and shortcut labels.

## Composed of

Button (the bar's entries), the Popover panel and entry drawing of Menu (`renderItem`), ListRow (submenu entries),
Chevron (the submenu mark).
