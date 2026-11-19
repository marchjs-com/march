# CornerMark

A small round mark in a corner of a picture, a card or an avatar: the video sign on a photo tile, the arrow that
appears on a project cover, the "+" badge on a story ring. The parent must be positioned (`position: relative`); a parent with class
`m-corner-host` is (unless its own CSS sets another position).

```tsx
<div class="tile"><Picture source={photo} fit="cover" /><CornerMark icon={video} /></div>
<a class="card m-corner-host" href={href}>…<CornerMark icon={arrowUpRight} variant="surface" show="hover" /></a>
<CornerMark corner="bottom-end" icon={plus} variant="solid" m:color="brand-orange" size="sm" ring overlap />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `corner` | `top-start` `top-end` `bottom-start` `bottom-end` | `top-end` | logical: "end" mirrors in right-to-left text |
| `icon` | icon / text / node | | children work too |
| `m:color` | color token | | Common prop (march/props): the colour token of the component and everything in it. |
| `size` | `sm` `md` `lg` | `md` | |
| `variant` | `scrim` `surface` `solid` | `scrim` | dark glass for photos, card colour with a shadow, or filled |
| `ring` | `boolean` | `false` | a ring in the surface colour (cuts the mark out of an avatar) |
| `show` | `always` `hover` | `always` | `hover`: visible while an ancestor with class `m-corner-host` is hovered or has focus inside (always on touch) |
| `overlap` | `boolean` | `false` | half outside the corner (a badge) |
| `label` | `string` / accessor | | accessible name; without it the mark is decorative |
| `class` | class value | | |

## Accessibility

Decorative by default (`aria-hidden`): say what it means in the name of the tile ("Video: …"). With `label` it is
`role="img"` with that name. It never takes pointer events, so the card under it stays clickable. `show="hover"` also
shows on keyboard focus and is always visible on touch screens; reduced motion: no slide.

## Composed of

—
