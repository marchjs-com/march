# FontPicker

Choose a typeface. The fonts of the device and a web font catalog (Google Fonts by default: about 1,900 open-licensed
families) sit in one searchable list. Each name is drawn in its own type, a specimen shows your own sample text with
size, weight and italic, and the list narrows by category, subset, order and favourites. It opens as a popover by its
button, as a dialog, or sits inline in a settings page. The value is the family name; `onPick` hands over the CSS to
use it.

```tsx
<FontPicker bind:value={$font} onPick={(f) => setStyle(page, { "font-family": f.stack, "font-weight": f.weight })} />
<FontPicker view="dialog" askConsent preview="sample" sample="Hello world" bind:value={$font} />
<FontPicker view="inline" source="/fonts" category="serif" favorites={false} bind:value={$font} />
<FontPicker catalog={ownFamilies} source={(r) => `/fonts/${r.family}.css`} system={false} bind:value={$font} />
```

## Loading and privacy

Nothing is requested until the picker opens. The catalog is a part of its own (names and facts only, no font files),
loaded with the first open. A preview asks the font source for the letters of one name only (a file of 1–3 KB), and
only for the rows in view after a short stay, so scrolling through 1,900 families never loads 1,900 fonts. Picking a
family loads the chosen style in full, then the value changes (`load={false}`: you load it; `onPick` gives the `url`).

With the default source the visitor's browser talks to Google (`fonts.googleapis.com` for the stylesheet,
`fonts.gstatic.com` for the files), which sees the IP address. Three ways to decide:

- `askConsent`: no request until the visitor presses Allow (the answer is remembered); names stay in the page's type.
- `source="/fonts"` (or any address): your own server or proxy that answers the same `/css2?family=…` requests; the
  browser then only talks to you. A function builds the stylesheet address yourself: `source={(request) => url}` with
  `request = { family, weights, italics, text? }`.
- `source={false}`: never load; only fonts already on the device or the page are drawn in their type.

A strict Content-Security-Policy must allow the source: for Google `style-src https://fonts.googleapis.com` and
`font-src https://fonts.gstatic.com`; for your own origin nothing changes.

`loadFont("Inter", { weights: [400, 700] })` loads a web font without the picker (at start-up, for a saved choice);
`fontStack(font)`, `fontUrl(source, request)`, `filterFonts(list, filter)` and `googleFonts()` are exported too.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | signal / string / accessor | `""` | the family name |
| `onChange` | `(family) => void` | — | |
| `onPick` | `(choice) => void` | — | every pick and change of weight / italic: `{ family, stack, category, source, weight, italic, url, font }` |
| `view` | `popover` `dialog` `inline` | `popover` | |
| `system` | boolean / `FontFamily[]` | `true` | fonts of the device: the built-in stacks, none, or your own (`{ family, category, source: "system", stack, weights, italics, subsets }`) |
| `catalog` | `false` / `FontFamily[]` / `() => Promise<FontFamily[]>` | Google Fonts | the web fonts listed |
| `source` | `"google"` / address / `(request) => url` / `false` | `"google"` | where web fonts are loaded from |
| `askConsent` | boolean | `false` | ask before the first request to the source |
| `load` | boolean | `true` | load the picked web font before the value changes |
| `weight` | number | `400` | weight chosen at first (the family's nearest is used) |
| `italic` | boolean | `false` | |
| `preview` | `name` `sample` | `name` | what a row draws in its type |
| `sample` | string | a pangram | the sample text; the visitor can edit it |
| `onSample` | `(text) => void` | — | |
| `category` | `all` `sans-serif` `serif` `display` `handwriting` `monospace` | `all` | shown at first, followed when it changes |
| `sort` | `popular` `name` `newest` | `popular` | |
| `subset` | string | `all` | `latin-ext`, `cyrillic`, `arabic`… |
| `search` | boolean | `true` | the search field |
| `categories` | boolean / list | `true` | the category switcher, or the categories offered |
| `sorts` | boolean / list | `true` | the order switcher |
| `subsets` | boolean / list | `true` | the subset list |
| `favorites` | boolean | `true` | stars, the Favourites group, "only favourites" |
| `onFavorite` | `(family, on) => void` | — | |
| `recent` | number | `5` | recent picks kept in their own group; `0`: none |
| `specimen` | boolean | `true` | the chosen font with the sample text |
| `sizeControl` | boolean | `true` | the size slider of the specimen |
| `styleControls` | boolean | `true` | weight and italic |
| `css` | boolean | `true` | the `font-family` line with a copy button |
| `meta` | boolean | `true` | second line of a row: category, number of styles |
| `count` | boolean | `true` | how many families match |
| `deviceFonts` | boolean | `true` | "Fonts on this device" where the browser can list them (asks the visitor) |
| `closeOnPick` | boolean | `false` | close the popover / dialog after a pick |
| `storageKey` | string / `false` | `"fonts"` | where favourites, recent picks and the consent are remembered |
| `open` / `onOpenChange` | boolean / signal | own state | open state of the popover / dialog |
| `trigger` | node / `(api) => node` | a button | your own button; `api`: `toggle()`, `open()`, `close()`, `font()` |
| `size` | `sm` `md` `lg` | `md` | size of the default button |
| `placement` | Popover placement | `bottom-start` | |
| `motion` | `scale` `fade` `rise` `none` | `scale` | entrance of the popover / dialog |
| `renderRow` | `(font, { selected, favorite }) => node` | — | draw the inside of a row yourself |
| `empty` | text / node / `false` | "No fonts match" | |
| `labels` | `FontPickerLabels` | built-in texts | every text: names of the groups, categories, orders, buttons, the consent notice, `count(n)`, `styles(n)` |
| `disabled` / `readonly` | boolean | `false` | |
| `color` | color token | accent | |
| `class` / `panelClass` | class | — | the wrapper / the panel |

## Accessibility

The button names the chosen font and says it opens a dialog. The search field is a combobox that drives the list:
focus stays in it, ↑ ↓ Page Up / Down move the highlighted family (`aria-activedescendant`), Enter picks it, Escape
clears the text and then closes. The list is a `listbox` of `option` rows (`aria-selected`); only the rows in view
exist, so each row says how many there are. The star beside a row is a toggle button with the family in its name.
Group headings are presentational. The sample text is a text area with its own name; size is a slider, weight a
select, italic a switch. The consent notice is an alert with one Allow button. Names appear dimmed in the page's
type until their font has arrived and then settle in (an opacity change that is off under reduced motion). The
panel keeps the theme and colour of its button; in a dialog Tab stays inside and focus returns to the button.

## Composed of

Popover and Dialog (the two overlays), SearchBox, Segmented (category, order), Select (subset, weight), VirtualList
with ListRow rows and SectionLabel group headings, IconButton (stars, device fonts), Button (the trigger, Allow,
Done), Textarea (the sample), Slider (size), Toggle (italic), CopyButton (the CSS line), Alert (the consent notice),
Empty (no match), the list-nav behavior and the storage manager.
