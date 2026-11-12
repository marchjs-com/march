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
| `separator` | string | `"•"` | loop separator |
| `fade` | boolean | `true` | fade the clipped edges; `false` shows an ellipsis |
| `play` | accessor | — | extra condition that keeps it scrolling |
| `host` | element / accessor | nearest a, button, li … | element whose hover / focus starts it |

## Accessibility

`dir="auto"` so mixed scripts read correctly; one readable copy (loop copies are `aria-hidden`); no movement under
reduced motion; the motion engine's global speed and "stop all" apply.

## Composed of

No other component; animated on the motion engine (transform only).
