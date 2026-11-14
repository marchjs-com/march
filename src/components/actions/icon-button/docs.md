# IconButton

A button that shows only an icon. `label` is required: it becomes the accessible name (`aria-label`) and the native
tooltip (`title`), so an icon-only control is never unnamed. Leaving it out throws while you develop.

```tsx
<IconButton icon={heart} label="Like" on:click={like} />
<IconButton icon={trash} label="Delete" variant="danger" size="sm" />
<IconButton icon={star} label="Star" m:color="brand-gold" title={false} />   // coloured, no native tooltip
<IconButton icon={pin} label="Pin" size="xs" pressed={$pinned} on:click={toggle} />        // toggle: aria-pressed + pressed look
<IconButton icon={send} label="Send" variant="solid" shape="round" m:color="brand-blue" />   // filled circle
<IconButton icon={arrowUp} label="Back to top" variant="raised" shape="round" />           // floating button
<IconButton icon={x} label="Close" inverse />                                              // on a photo / video
<IconButton icon={globe} label="Website" href="https://example.com" />                     // a link
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `icon` | icon | — | |
| `label` | string / accessor | — | required: accessible name and title |
| `size` | `xs` `sm` `md` `lg` | `md` | 1.5 / 1.875 / 2.25 / 2.75 rem |
| `variant` | `danger` `solid` `raised` | — | `danger`: red icon; `solid`: filled with the accent; `raised`: surface, border and shadow |
| `shape` | `round` | — | a circle |
| `m:color` | color token | — | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `pressed` | boolean / accessor | — | toggle button: `aria-pressed` and the pressed look (`is-pressed`); unset: a plain button |
| `inverse` | boolean / accessor | `false` | light icon, hover and focus ring for dark media; with `raised`: a light disc |
| `href` | Href | — | renders a link: the router's Link inside the app, a plain `<a>` for an external address |
| `title` | string / accessor / `false` | the label | native tooltip; `false`: none (e.g. inside a Tooltip) |
| `aria-label` | string / accessor | — | the name when no `label` is given (no tooltip then) |
| `class` | class | — | extra classes on the button |
| `children` | node | — | follows the icon (alone when no `icon` is given), e.g. a count Badge |

Other attributes (`onClick`, `disabled`, `aria-expanded` …) go to the `<button>` / `<a>`. A count Badge placed inside
sits on its corner. For an icon with a number beside it (a like count), use `Button` with `variant="ghost"`,
`shape="pill"`, `icon` and the number as its children.

## Accessibility

Always named; the hit area keeps the control size (2.25 rem, 1.875 rem small) even though the icon is small. `xs`
(1.5 rem) is for dense rows next to other targets; `pressed` sets `aria-pressed` (not on a link).
