# SearchBox

The search field: an icon, the input, a clear button and a shortcut hint. The value is debounced (`debounce={0}`
writes every keystroke at once), Escape clears, Enter searches now. With `controls` it is the input of a combobox that
drives a list of options. Every part can be turned off or replaced.

```tsx
<SearchBox bind:value={$q} onSearch={(q) => load(q)} shortcut />                      // "/" focuses it
<SearchBox size="sm" debounce={0} bind:value={$filter} placeholder="Filter…" />        // a side panel filter
<SearchBox variant="plain" debounce={0} bind:value={$q} controls={listId}
  activeDescendant={() => `${listId}-${$active}`} onKeyDown={keys} shortcutHint="escape" />   // a palette input
<SearchBox icon={false} clear={false} inputRef={(el) => input = el} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | signal / string / accessor | `""` | |
| `onSearch` | `(q) => void` | — | the debounced value; at once on Enter and on clear |
| `onEnter` | `(q) => void` | — | Enter |
| `onInput` | `(q) => void` | — | every keystroke, before the debounce |
| `debounce` | ms | `250` | `0`: no delay |
| `size` | `sm` `md` | `md` | |
| `variant` | `field` `plain` | `field` | `plain`: no border or ring (the panel around it draws the frame) |
| `icon` | boolean / icon | `true` | the leading magnifier, none, or your own |
| `clear` | boolean / icon | `true` | the clear button (shown while there is text), none, or your own icon |
| `clearLabel` | string | "Clear search" | accessible name of the clear button |
| `placeholder` | string | "Search…" | |
| `label` | string | placeholder / "Search" | accessible name of the input |
| `shortcut` | `true` / combo | — | `true`: "/" focuses the box from anywhere |
| `shortcutHint` | boolean / combo | the shortcut | the key hint at the end; `false`: the key works without a hint |
| `inputRef` | `(el) => void` | — | the input element |
| `inputClass` | string | — | extra class on the input element |
| `onKeyDown` | `(e) => void` | — | runs first; `preventDefault()` skips the box's own Escape / Enter |
| `controls` | id | — | combobox: the list this box filters (`role="combobox"`, `aria-controls`) |
| `activeDescendant` | id / accessor | — | combobox: the highlighted option |
| `expanded` | boolean / accessor | `true` | combobox: whether the list is shown |
| `disabled` | boolean | `false` | |
| `id` | string | — | id of the input |
| `m:color` | color token | accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `class` | class value | — | |

## Accessibility

The wrapper is a `search` landmark; the input is `type="search"` with an accessible name (`label`, else the
placeholder). The clear button is an IconButton with its own name and returns focus to the input. Escape clears a
filled box first (and only then reaches a dialog around it). The shortcut hint is decorative (`aria-hidden`); the
shortcut itself is listed with the other keys. As a combobox the input carries `role="combobox"`,
`aria-controls`, `aria-expanded` and `aria-activedescendant`; arrow keys come through `onKeyDown` (use the list-nav
behavior or OptionList's `keysFrom`).

## Composed of

IconButton (clear), Kbd (shortcut hint).
