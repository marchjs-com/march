# ScrollToTop

A "back to top" button that appears once the page is scrolled down and scrolls back to the top smoothly
(at once with reduced motion; it keeps its aim while content above loads). It follows
whatever scrolls: the window or a scrolling container. By default it puts itself into the bottom-end page corner; in a
Layout it is the `scrollToTop` feature (on by default).

```tsx
import { ScrollToTop } from "hadi-march/ui";

<ScrollToTop />                          // once; shows after 320 px
<ScrollToTop threshold={600} order={-1} />
<ScrollToTop inline target={box} />      // in place, for a scrolling box
<ScrollToTop icon={chevronUp} color="brand-blue" motion="fade" label="Up" class="my-top" />
<ScrollToTop motion={(el, shown) => animate(el, { opacity: shown ? [0, 1] : [1, 0], rotate: shown ? [-90, 0] : [0, 90] }, { duration: 300, fill: "forwards" })} />
<ScrollToTop motion="none" smooth={false} />   // no animation at all
```

## Props

| Prop | |
|---|---|
| `threshold` | Scrolled distance (px) after which it shows. Default 320. |
| `order` | Place in the corner (lower = nearer the edge). |
| `inline` | Render where it is written instead of the corner. |
| `target` | What to scroll; default: what the user last scrolled. |
| `label` | Accessible name and tooltip (string or accessor); default "Back to top" (translated). |
| `icon` | The icon (a node or an icon); default: an up arrow. |
| `color` | Color token of the icon and border; default: text colour, the theme's primary on hover. |
| `motion` | How it appears and leaves: `pop` (default), `fade`, `slide`, `none` / `false`, or `(el, shown) => …` for your own animation. |
| `smooth` | Scroll back smoothly (default `true`); `false` jumps at once. |
| `class` | Extra classes on the button (`.hm-to-top`). |

## Accessibility

An icon button with a translated name; while hidden it is `inert` (out of the tab order and the accessibility tree).

## Composed of

IconButton; BottomRightControls (the corner).
