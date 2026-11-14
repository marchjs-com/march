# OverflowText

Text that scrolls only when it does not fit; text that fits stays put. It starts on hover or focus of its nearest
link, button or list item (or always, or while visible), and moves in one of three modes: bounce to the end and back,
an endless loop with a separator, or once. The clipped edges fade on the logical side (RTL scrolls the other way),
screen readers read the text once, and under reduced motion it does not move: the end fades and the full text is in
the tooltip. `Marquee` is the endless ticker preset (`trigger="visible"`, `mode="loop"`).

```tsx
<OverflowText text={title} />
<Marquee text="New: dark theme · faster search · RTL" separator="✦" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `text` | string / accessor | — | the text (or children) |
| `trigger` | `"hover"` `"focus"` `"always"` `"visible"` (or a list) | hover + focus | when it scrolls |
| `mode` | `"bounce"` `"loop"` `"once"` | `"bounce"` | how it scrolls |
| `speed` | number | `40` | pixels per second |
| `pause` | ms | `1000` | hold at each end |
| `delay` | ms | `250` | wait after the trigger |
| `separator` | text / node / `false` | `"•"` | loop separator; `false`: nothing between the copies |
| `easing` | CSS easing | `"ease-in-out"` | each travel in bounce / once (the loop is linear) |
| `duplicate` | boolean / number | `false` | an endless strip: the content is repeated (`true`: enough copies to fill the width; a number: that many) |
| `disabled` | boolean / accessor | `false` | never scroll: the text stays clipped with its fade or ellipsis |
| `fade` | boolean | `true` | fade the clipped edges; `false` shows an ellipsis |
| `play` | accessor | — | extra condition that keeps it scrolling |
| `host` | element / accessor | nearest a, button, li … | element whose hover / focus starts it |
| `class` | class value | — | other attributes pass through to the element |

```tsx
<Marquee text={news} separator={<Icon of={star} />} />
<OverflowText text={title} easing="linear" disabled={() => !prefs.motion} />
<Marquee duplicate separator={false} pause={0}>{logos.map((l) => <Logo {...l} />)}</Marquee>
```

With `duplicate` a short content (a row of logos, a few quotes) still fills the box and loops: the content is a
`.hm-marquee-unit` and its copies follow it (space them with a gap and an end padding on that class). The copies are
`aria-hidden` and `inert`, so links and buttons in them are neither read nor focused.

## Accessibility

`dir="auto"` so mixed scripts read correctly; one readable copy (loop and `duplicate` copies are `aria-hidden` and inert); no movement under
reduced motion; the motion engine's global speed and "stop all" apply.

## Composed of

No other component; animated on the motion engine (transform only).
