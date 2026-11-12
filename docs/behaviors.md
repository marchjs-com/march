# Behaviors

A behavior is one interaction written once and attached to any element: `src/behaviors/<name>/` (index.ts, the
implementation, a test), imported from its own subpath `hadi-march/behaviors/<name>` so an app downloads only the
behaviors it uses. Components list theirs in `meta.ts › behaviors`. Every behavior works as a `use:` action:
`<div use:draggable={[draggable, options]}>` (the return value is the cleanup).

## drag — `hadi-march/behaviors/drag`

The one source of pointer dragging: resize handles, column and tab reordering, tree and calendar items, canvas nodes,
sheets. Do not write `pointermove` / `pointerup` / `setPointerCapture` loops in components; use this.

```ts
import { draggable, pointerDrag } from "hadi-march/behaviors/drag";

// bind an element: each press on the handle is a session
const off = draggable(card, { handle: ".grip", scroll: list, onMove: (p) => move(p.di, p.dy), onEnd: (p, cancelled) => cancelled ? revert() : drop(p) });

// or start one session from your own pointerdown
el.addEventListener("pointerdown", (e) => pointerDrag(e, { threshold: 0, onMove: (p) => setWidth(w0 + p.di) }));
```

| Option | | |
|---|---|---|
| `threshold` | px, default 4 | below it, pointerup is a click (`onClick`) and no drag starts |
| `scroll`, `edge` | element, px (48) | edge auto-scroll of that container on the motion clock (pause and speed apply) |
| `onStart`, `onMove`, `onEnd(p, cancelled)`, `onClick(e)` | | `cancelled`: Escape, pointercancel or the returned `stop()` |
| `handle`, `ignore` | selectors | `draggable` only: the part that starts a drag; parts that never do (form fields, links, buttons) |
| `button`, `disabled`, `onPress(e)` | | `draggable` only: mouse button (0), off switch, per-press veto |

A drag point is `{ dx, dy, di, clientX, clientY, event }`: deltas since the press including the scroll container's
change; `di` is `dx` along the writing direction (positive toward the inline end, so RTL is mirrored for you).

**Inside an area** (editors: color areas, sliders, curve handles, timeline heads, crop frames): `track(el, { onMove,
onStart, onEnd, rtl, area, clamp, buttons })` gives `{ x, y }` as 0–1 fractions of the area (x mirrored in RTL when
asked), pixels and deltas, and calls `onMove` on the press itself so a click jumps. `arrowStep(keyEvent, rtl)` turns
arrows / Page / Home / End into a step for the same controls.

`hadi-march/motion`'s `pointerDrag` is the same function (re-exported). Gesture effects (`drag`, `swipe`, `tilt` in
`hadi-march/motion`) are animations of an element following the pointer; they stay in the motion module.

## roving-focus — `hadi-march/behaviors/roving-focus`

Roving tabindex: a toolbar, list or grid is one Tab stop; arrow keys, Home and End move inside it, and ArrowLeft /
ArrowRight swap in a right-to-left container. `focus.roving()` and `focus:roving` of the FocusManager are this behavior.

```ts
import { rovingFocus } from "hadi-march/behaviors/roving-focus";
const stop = rovingFocus(toolbar, { orientation: "horizontal", onMove: (el) => select(el.dataset.id) });
```

| Option | | |
|---|---|---|
| `orientation` | `"vertical"` (default), `"horizontal"`, `"both"` | which arrows move |
| `wrap` | boolean (true) | past the last item comes the first |
| `selector` | CSS selector | the items (default: focusables, `[tabindex]`, `[data-roving]`); disabled and hidden ones are skipped |
| `onMove(el)` | | the newly active item |

The focus trap stays in the FocusManager: traps stack app-wide (only the newest is active), which needs one owner.

## resize-handle — `hadi-march/behaviors/resize-handle`

A separator that resizes something: split panes (Splitter), a sidebar (NavSidebar), table and grid columns, panels.

```ts
import { resizeHandle } from "hadi-march/behaviors/resize-handle";

resizeHandle(grip, { value: () => width, set: (w, done) => { setWidth(w); if (done) save(); }, min: 160, max: 480, reset: () => setWidth(280) });
```

| Option | | |
|---|---|---|
| `value()`, `set(v, done)` | | current size in any unit; `set` gets it clamped, `done` when a gesture or key press ends |
| `min`, `max` | | clamp and `aria-valuemin` / `aria-valuemax`; Home / End jump to them |
| `step`, `bigStep` | 16, 4 × step | arrow keys; Shift and Page Up / Down use `bigStep` |
| `scale()` | 1 | size units per pointer pixel (a percent split: `() => 100 / width`) |
| `axis`, `invert` | "inline" | "block" resizes up / down; `invert` for a panel that grows toward the start edge |
| `reset()` | | Enter and double click |
| `onStart`, `onEnd(cancelled)` | | the element also has `is-dragging` while dragged |

It sets `role="separator"`, the orientation, `aria-valuenow` (kept current) and `tabindex="0"` unless the element
already has one. Dragging is the drag behavior (`di`, so RTL is mirrored; Escape puts the size back), and arrows swap in
RTL. Clicks on the handle do not reach a header behind it (no accidental sort).
