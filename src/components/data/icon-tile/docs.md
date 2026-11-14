# IconTile

An icon in a tinted, rounded square: the lead of a card, a list row, an empty state or a flow node. The tint is one of
nine named tones or any theme colour token.

```tsx
<IconTile icon={users} tone="primary" />
<IconTile icon={bell} color="brand-orange" variant="solid" shape="round" size="lg" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `icon` | icon / text / node | | |
| `tone` | `primary` `neutral` `success` `warn` `danger` `info` `violet` `pink` `teal` | `primary` | |
| `color` | color token | | any theme colour (`brand-orange`, `cat-3`…); wins over `tone` |
| `size` | `sm` `md` `lg` | `md` | |
| `variant` | `soft` `outline` `solid` | `soft` | tinted ground, framed plain ground, or filled |
| `shape` | `square` `round` | `square` | |
| `label` | `string` / accessor | | accessible name; without it the tile is decorative |
| `class` | class value | | |
| children | node | | own content instead of the icon |

## Accessibility

Decorative by default (`aria-hidden`): the text beside it names the thing. With `label` it becomes `role="img"` with
that name. Colours come from theme tokens, so contrast follows the theme.

## Composed of

—
