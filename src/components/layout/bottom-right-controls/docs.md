# BottomRightControls (page corners)

Four fixed page corners — `top-start`, `top-end`, `bottom-start`, `bottom-end` (start/end mirror in RTL) — that
page-wide controls put themselves into: back to top, a chat bubble, a feedback button, a connection badge. Controls do not
each pick a fixed position and overlap: they stack in their corner in `order`. `BottomRightControls` is the bottom-end
corner. Inside a Layout use `useLayout().add(corner, node)` or the `corners` prop.

```tsx
import { addCornerControl, BottomRightControls, CornerControls } from "hadi-march/layout";

const off = addCornerControl("bottom-end", <button>Geri bildirim</button>, 10)  // lower order = nearer the edge
off()                                                                           // also on component cleanup
<CornerControls corner="top-end" />   // render a corner yourself (else it is made on first use)
```

## Props

| Prop | |
|---|---|
| `corner` (CornerControls) | Which corner; default `bottom-end`. |
| `label` | Accessible name of the corner group (string or accessor); default "Page controls" (translated). |
| `class` | Added to the corner element (`.hm-corner`, `.hm-corner-<corner>`). |

```tsx
<BottomRightControls label="Quick actions" class="my-corner" />
```

Functions: `addCornerControl(corner, node, order?)`, `cornerControls(corner)`, `addBottomRightControl(node, order?)`,
`bottomRightControls()`.

## Accessibility

Each corner is a `role="group"` named "Page controls" (translated); empty corners are not drawn; safe-area insets are
kept; corners are hidden when printing.

## Composed of

No other component.
