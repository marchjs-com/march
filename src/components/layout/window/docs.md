# Window

A window inside its area (the nearest positioned ancestor): move it by the title bar, resize it by an edge or a corner,
dock it to half of the area by dropping it on an edge, fill the area, fold it to its title bar, close it. Three looks:
`"hadi"` (default), `"mac"` and `"windows"`.

```tsx
import { Window } from "hadi-march/layout";

<div class="desk">                                   {/* position: relative; any size */}
  <Window title="Notlar" chrome="mac" persist="notes">…</Window>
</div>
```

- Drag the title bar to move; drop it on the inline start / end edge to take that half, on the bottom edge for the
  lower half, on the top edge to fill. A filled or docked window dragged away gets its own size back under the pointer.
- Double click the title bar: fill / restore.
- `persist` keeps place, size and state in localStorage.
- The window stays reachable: when the area shrinks, the window moves and shrinks with it.
- Geometry is logical: in a right-to-left page x runs from the right.
- `TerminalWindow` (hadi-march/composite) is a Terminal in a Window.

## Props

| Prop | |
|---|---|
| `title`, `icon` | Title text (live) and an icon node. |
| `chrome` | `"hadi"` (default), `"mac"`, `"windows"`. Live. |
| `x`, `y`, `width`, `height` | Start place and size in px (default 32 × 20 rem, centered). |
| `minWidth`, `minHeight` | Smallest size (default 220 × 120). |
| `state`, `onStateChange` | `"normal"`, `"minimized"`, `"maximized"`, `"start"`, `"end"`, `"bottom"`. |
| `open`, `onClose` | Shown while `open` is true (live); without it the close button hides the window. |
| `minimizable`, `maximizable`, `closable` | Which buttons to show (default all). |
| `movable`, `resizable`, `snap` | Turn moving, resizing or docking off. |
| `persist` | localStorage key part for place, size and state. |
| `ref` | Receives `{ state, set, restore, close, focus }`. |
| `labels` | Texts of the buttons and the title bar: `{ close, minimize, restore, maximize, move, moveHint }` (each optional; the defaults are translated). |
| `icons` | Your own button icons: `{ close, minimize, maximize, restore }`, an icon, a text or a node each. |
| `color` | Color token for the accent of the frame: the title icon and button hover of the "hadi" look, and the dock preview. |
| `stripe` | `false` removes the brand stripe of the "hadi" look. |
| `animated` | `false`: place and size change at once (no transition). |
| `class` | Added to the frame (`.m-win`); parts: `.m-win-bar`, `.m-win-icon`, `.m-win-title`, `.m-win-buttons`, `.m-win-btn` (`.m-win-close` / `-min` / `-max`), `.m-win-body`, `.m-win-snap`. |

```tsx
<Window title="Notes" labels={{ close: "Close notes", maximize: "Full size" }} icons={{ close: "✕", minimize: chevronDown }} />
<Window title="Notes" color="brand-orange" stripe={false} animated={false} />
```

## Accessibility

The window is a `section` named by its title. The title bar is focusable: arrows move the window (Alt: 1 px), Shift and
arrows resize it, Enter fills or restores, Escape restores a filled, docked or folded window. Every button has a name
that follows the state ("Fill the area" / "Restore"). Reduced motion turns the size and place transitions off.

## Composed of

PanelHeader (the title bar: drag bar, icon, title, buttons), IconButton (close, minimize, fill), ResizeHandle (the edge and corner grips). It uses the drag behavior (track, arrowStep) and observeSize.
