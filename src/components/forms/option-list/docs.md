# OptionList

A list of choices inside a panel: a theme or accent picker, a type menu, the suggestions under a field. Each row has
a lead (icon, swatch, avatar), a label, a hint, a trailing part and a tick when chosen. It is a radio group by
default, a listbox (one or many) or a menu of commands; a field can drive it with its own keys (`keysFrom`).

```tsx
<OptionList bind:value={$theme} label="Theme"
  options={[{ value: "light", label: "Light", icon: sun }, { value: "dark", label: "Dark", icon: moon, hint: "Easy on the eyes" }]} />
<OptionList multiple bind:value={$columns} options={columns} label="Columns" />
<OptionList mode="menu" options={blockTypes} onPick={(type) => insert(type)} />             // commands
<SearchBox inputRef={(el) => input = el} debounce={0} bind:value={$q} />
<OptionList keysFrom={() => input} options={$matches} onPick={choose} empty="No match" />    // suggestions
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `options` | `OptionItem[]` / accessor | — | `{ value, label, hint?, icon?, trailing?, disabled?, group? }` |
| `value` / `bind:value` | signal / value / accessor | own state | the chosen value (an array with `multiple`) |
| `onPick` | `(value, item, e) => void` | — | click, Enter, Space |
| `multiple` | boolean | `false` | several values (listbox) |
| `mode` | `radio` `listbox` `menu` | `radio` | `menu` without a value: commands, nothing stays chosen |
| `keysFrom` | element / accessor | — | the field whose arrow keys / Enter drive the list (focus stays in the field) |
| `active` | signal (index) | own | the highlighted row with `keysFrom` / `keys={false}` |
| `keys` | boolean | `true` | `false`: no key listener, no field attributes; rows are options `<id>-<index>` highlighted from `active` (the owner handles keys: Combobox) |
| `overflow` | `ellipsis` `wrap` | `ellipsis` | a label that does not fit is cut or wrapped |
| `label` | string | — | accessible name of the list |
| `id` | string | generated | rows are `<id>-<index>` |
| `check` | boolean / icon / `() => node` | `true` | the tick on a chosen row |
| `columns` | number | `1` | rows per line (a grid; arrows move in two directions) |
| `size` | `sm` `md` | `md` | |
| `inline` | boolean | `false` | hint beside the label |
| `empty` | text / node / false | "No results" | shown when there are no options |
| `renderOption` | `(item, { selected, active, index }) => node` | — | draw the inside of a row yourself |
| `m:color` | color token | accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `class` | class value | — | |

Rows with the same `group` follow one SectionLabel heading.

## Accessibility

`radio`: a `radiogroup` of `radio` rows (`aria-checked`); `listbox`: `option` rows (`aria-selected`,
`aria-multiselectable`); `menu`: `menuitem` / `menuitemradio`. The list is one Tab stop (the chosen row, else the
first); ↑ ↓ (and ← → in a grid, mirrored in RTL), Home, End, Page Up / Down move focus and step over disabled rows;
Enter or Space chooses. With `keysFrom` the rows are not focusable: the field keeps focus, gets `aria-controls` and
`aria-activedescendant`, its ↑ ↓ / Enter move and choose, the highlighted row scrolls into view. Group headings are
presentational. Give the list a `label`.

## Composed of

ListRow (every row), SectionLabel (group headings), the list-nav behavior.
