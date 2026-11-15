# IconPicker

Choose an icon. A button shows the chosen icon and its name; it opens a panel with a search (by name), filter chips
(arrows, files, media, messages, people, layout, filled) and a grid of every built-in icon. The value is the icon's
export name (`"plus"`); `ICONS[name]` (hadi-march/icons/catalog) gives the icon itself.

```tsx
let $icon = "plus"
<IconPicker value={$icon} onChange={(n) => $icon = n} />
<IconPicker inline groups={false} value={$icon} onChange={(n) => $icon = n} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | string / signal / accessor | — | the chosen icon's name; `null`: none |
| `onChange` | `(name \| null) => void` | — | after a choice (a signal `value` is set too) |
| `icons` | `{ [name]: IconDef }` | every built-in icon | the icons to choose from |
| `groups` | `IconGroup[]` / `false` | `ICON_GROUPS` | the filter chips: `{ id, label, match: RegExp \| (name, def) => boolean }` |
| `none` | boolean | `true` | a "No icon" choice |
| `inline` | boolean | `false` | the panel right in the page, without the button |
| `label` | string | "Icon" | accessible name of the button and the panel |
| `placeholder` | string | "Search icons" | of the search |
| `size` | `"sm"` / `"md"` | `"sm"` | the button |
| `class` | class value | — | on the button (inline: on the panel) |

## Keyboard

Tab reaches the search, the chips and the grid; Enter / Space chooses; Escape closes the panel (the button gets the focus
back).

## Accessibility

The button's name says the chosen icon ("Icon: plus"); every grid button has the icon's name and `aria-pressed` on the
chosen one; the number of icons shown is announced (polite) while searching.

## Composed of

Dropdown (the button and its panel), SearchBox (the search), Chip (the filters), IconButton (every icon), Empty (no match).
