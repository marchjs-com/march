# ScrollToTop

A "back to top" button that appears once the page is scrolled down and scrolls back to the top on the motion engine
(global speed, "stop all" and reduced motion apply); the user taking over (wheel, touch, keys) stops it. It follows
whatever scrolls: the window or a scrolling container. By default it puts itself into the bottom-end page corner; in a
Layout it is the `scrollToTop` feature (on by default).

```tsx
import { ScrollToTop } from "hadi-march/ui";

<ScrollToTop />                          // once; shows after 320 px
<ScrollToTop threshold={600} order={-1} />
<ScrollToTop inline target={box} />      // in place, for a scrolling box
```

## Props

| Prop | |
|---|---|
| `threshold` | Scrolled distance (px) after which it shows. Default 320. |
| `order` | Place in the corner (lower = nearer the edge). |
| `inline` | Render where it is written instead of the corner. |
| `target` | What to scroll; default: what the user last scrolled. |
| `label` | Accessible name; default "Back to top" (translated). |

## Accessibility

An icon button with a translated name; while hidden it is `inert` (out of the tab order and the accessibility tree).

## Composed of

IconButton; BottomRightControls (the corner).
