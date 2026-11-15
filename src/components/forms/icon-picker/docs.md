# IconPicker

Choose an icon. A button shows the chosen icon and its name; it opens a panel with a search (by name), filter chips
(arrows, files, media, messages, people, layout, filled) and a grid of every built-in icon. The value is the icon's
export name (`"plus"`); `ICONS[name]` (hadi-march/icons/catalog) gives the icon itself.

```tsx
let $icon = "plus"
<IconPicker value={$icon} onChange={(n) => $icon = n} />
<IconPicker inline groups={false} value={$icon} onChange={(n) => $icon = n} />
```

**More icon sets.** `packs` adds sets (Lucide, Tabler, Phosphor…) as chips above the grid; several can be on at once (their icons together), the last one stays on. A set is loaded only when it
is first chosen (or when the value names it), once for the page; a value from it is `"id:name"` (`"lucide:arrow-left"`).
The grid draws `pageSize` icons (240) and the next page as it is scrolled to its end, so thousands of icons stay quick.

```tsx
const packs = [{ id: "lucide", label: "Lucide", count: 2356, load: () => import("hadi-march/icons/lucide").then((m) => Object.fromEntries(Object.values(m).map((d) => [d.name, d]))) }]
<IconPicker packs={packs} value={$icon} onChange={(n) => $icon = n} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | string / signal / accessor | — | the chosen icon's name; `null`: none |
| `onChange` | `(name \| null) => void` | — | after a choice (a signal `value` is set too) |
| `icons` | `{ [name]: IconDef }` | every built-in icon | the icons to choose from |
| `packs` | `IconPickerPack[]` | — | more sets: `{ id, label, count?, load: () => Promise<{ [name]: IconDef }> }`, loaded when chosen |
| `setLabel` | string | "March" | the name of `icons` in the set list |
| `pageSize` | number | `240` | icons drawn at once; scrolling to the end draws as many more |
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

Dropdown (the button and its panel), Chip (the icon sets and the filters; both combine), SearchBox (the search), Chip (the filters), IconButton
(every icon), Spinner (a set loading), Empty (no match).
