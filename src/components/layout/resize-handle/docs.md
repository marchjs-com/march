# ResizeHandle

The ready element of the resize-handle behavior: a thin strip on an edge (or a corner) of what it resizes, with one
look everywhere — a line that lights up on hover, focus and while dragging. With `value` + `set` it is a complete
separator (drag, arrow keys, Home / End, Enter or double click resets, ARIA). Without them it is the bare grip for an
owner that runs its own gesture (a window corner, the end of a calendar event).

```tsx
<aside class="panel">                                       {/* the parent is positioned */}
  …
  <ResizeHandle value={() => $w} set={(w, done) => { $w = w; if (done) save(w) }} min={160} max={480}
    reset={() => $w = 240} label="Sidebar width" />
</aside>
<th>Name <ResizeHandle value={() => width(col)} set={(w) => setWidth(col, w)} min={60} tabindex="-1" /></th>
<ResizeHandle edge="top" value={() => $h} set={(h) => $h = h} grip />                    // a bottom panel
<ResizeHandle edge="between" value={() => $ratio} set={setRatio} scale={() => 100 / width} line="always" />
<ResizeHandle edge="bottom-end" onPointerDown={startResize} onStep={(dx, dy) => resizeBy(dx, dy)} />   // a corner
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `edge` | `end` `start` `top` `bottom` · `top-start` `top-end` `bottom-start` `bottom-end` · `between` | `end` | edge or corner of the positioned parent; `between`: in the flow between two flex items |
| `value` | number / accessor | — | the current size; with `set` the handle is the full separator |
| `set` | `(v, done) => void` | — | apply a size (clamped); `done` when the gesture ends |
| `min`, `max` | number | — | |
| `step`, `bigStep` | number | `16`, 4 × step | keyboard step; Shift and Page keys take the big one |
| `scale` | `() => number` | `1` | size units per pointer pixel (a percent split) |
| `axis` | `inline` `block` | from the edge | direction of a `between` handle |
| `invert` | boolean | `true` for `start` / `top` | the thing grows toward the start |
| `reset` | `() => void` | — | Enter and double click |
| `onStart`, `onEnd` | function | — | around a drag |
| `onStep` | `(dx, dy, e) => void` | — | without `value` + `set`: arrow keys (px, RTL mirrored; Shift × 4) |
| `label` | string | "Resize" | accessible name |
| `line` | `hover` `always` `none` | `hover` | the line |
| `grip` | boolean / node | `false` | a visible grip in the middle: a short bar, or your own node |
| `m:color` | color token | accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `disabled` | boolean | `false` | no pointer, no focus |
| `ref` | `(el) => void` | — | the element |
| `class` | class value | — | |
| other | — | — | events (`onPointerDown`…), `tabindex`, `data-*` go to the element |

## Accessibility

With `value` + `set`: `role="separator"` with its orientation, `aria-valuenow` / `min` / `max` kept current, an
accessible name (`label`), focusable (a grid that manages focus passes `tabindex="-1"`). Arrows step (mirrored in
RTL), Shift and Page keys take big steps, Home / End go to the limits, Enter resets, Escape during a drag restores.
A bare grip is `aria-hidden` and not focusable: its owner offers the keyboard way (or pass `onStep` to make the grip
itself focusable with arrow keys). The focus ring is the line itself; on touch screens the hit strip is wider.

## Composed of

The resize-handle behavior (`hadi-march/behaviors/resize-handle`).
