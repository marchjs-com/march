# SectionLabel

The small heading of a group inside a panel: a menu, a palette, a sidebar, a property grid, an editor side panel.
Small, uppercase and faint, with an optional icon, a count and an actions slot at the end.

```tsx
<SectionLabel>Recent</SectionLabel>
<SectionLabel icon={star} count={$favorites.length}
  actions={<IconButton size="sm" icon={plus} label="Add" onClick={add} />}>Favorites</SectionLabel>
<SectionLabel as="h3" upper={false} rule>Typography</SectionLabel>
<SectionLabel as="li" role="presentation">Commands</SectionLabel>      // a group heading inside a listbox
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `children` / `label` | node / accessor | — | the text |
| `as` | `div` `p` `span` `legend` `li` `h2`–`h6` | `div` | root element |
| `icon` | icon / node | — | before the text |
| `count` | number / node / accessor | — | after the text |
| `actions` | node / accessor | — | the end side |
| `upper` | boolean | `true` | uppercase with wide tracking; `false` keeps the text as written |
| `size` | `sm` `md` | `sm` | |
| `rule` | boolean | `false` | a thin rule that fills the row after the text |
| `color` | color token | faint | colour of the text |
| `class` | class value | — | |
| other | — | — | `id`, `role`, `aria-*`, events go to the root |

## Accessibility

Choose the element with `as`: a heading level where the label starts a section of the page, `legend` in a
`<fieldset>`, `li` + `role="presentation"` inside a listbox, plain `div` when a group is named through
`aria-labelledby` (give the label an `id`). Uppercase is a CSS transform only: screen readers read the text as written.
The icon is decorative.

## Composed of

—
