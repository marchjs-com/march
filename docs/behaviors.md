# Behaviors

A behavior is one interaction written once and attached to any element: `src/behaviors/<name>/` (index.ts, the
implementation, a test), imported from its own subpath `march/behaviors/<name>` so an app downloads only the
behaviors it uses. Components list theirs in `meta.ts › behaviors`. Every behavior works as a `use:` action:
`<div use:draggable={[draggable, options]}>` (the return value is the cleanup).

## drag — `march/behaviors/drag`

The one source of pointer dragging: resize handles, column and tab reordering, tree and calendar items, canvas nodes,
sheets. Do not write `pointermove` / `pointerup` / `setPointerCapture` loops in components; use this.

```ts
import { draggable, pointerDrag } from "march/behaviors/drag";

// bind an element: each press on the handle is a session
const off = draggable(card, { handle: ".grip", scroll: list, onMove: (p) => move(p.di, p.dy), onEnd: (p, cancelled) => cancelled ? revert() : drop(p) });

// or start one session from your own pointerdown
el.addEventListener("pointerdown", (e) => pointerDrag(e, { threshold: 0, onMove: (p) => setWidth(w0 + p.di) }));
```

| Option | | |
|---|---|---|
| `threshold` | px, default 4 | below it, pointerup is a click (`onClick`) and no drag starts |
| `hold` | ms | touch only: the drag starts after a long press; a finger that moves earlier scrolls the page (mouse and pen drag at once) |
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

`march/motion`'s `pointerDrag` is the same function (re-exported). Gesture effects (`drag`, `swipe`, `tilt` in
`march/motion`) are animations of an element following the pointer; they stay in the motion module.

## roving-focus — `march/behaviors/roving-focus`

Roving tabindex: a toolbar, list or grid is one Tab stop; arrow keys, Home and End move inside it, and ArrowLeft /
ArrowRight swap in a right-to-left container. `focus.roving()` and `focus:roving` of the FocusManager are this behavior.

```ts
import { rovingFocus } from "march/behaviors/roving-focus";
const stop = rovingFocus(toolbar, { orientation: "horizontal", onMove: (el) => select(el.dataset.id) });
```

| Option | | |
|---|---|---|
| `orientation` | `"vertical"` (default), `"horizontal"`, `"both"` | which arrows move |
| `wrap` | boolean (true) | past the last item comes the first |
| `selector` | CSS selector | the items (default: focusables, `[tabindex]`, `[data-roving]`); disabled and hidden ones are skipped |
| `onMove(el)` | | the newly active item |

The focus trap stays in the FocusManager: traps stack app-wide (only the newest is active), which needs one owner.

## resize-handle — `march/behaviors/resize-handle`

A separator that resizes something: split panes (Splitter), a sidebar (NavSidebar), table and grid columns, panels.

```ts
import { resizeHandle } from "march/behaviors/resize-handle";

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

## list-nav — `march/behaviors/list-nav`

Keyboard movement through options, written once. `moveCursor({ key, index, count, columns, page, ctrl, rtl })` is the
pure step (arrows, Home / End, Page Up / Down; a wrapped grid with `columns`; ArrowLeft / Right swap in RTL): DataGrid
and TreeView use it. `listNav({ count, active, onPick, onOpen, isOpen, loop, page, onMove })` is the keydown handler of
the aria-activedescendant pattern, where focus stays in a field and `active` is the highlighted option: Combobox /
Select pickers and CommandPalette use it. Home / End need Ctrl / ⌘ there (alone they move the caret). To move real
focus among buttons, use roving-focus.

```ts
const onKey = listNav({ count: () => rows().length, active, onPick: (i) => run(rows()[i]), onMove: (i) => scrollToOption(i) });
input.addEventListener("keydown", onKey);
```

## dropzone — `march/behaviors/dropzone`

An element that takes dropped (and, with `paste: true`, pasted) files: `dropzone(zone, { onFiles, onOver, accept,
onReject, single, paste, disabled })`. Enter / leave are counted, so passing over the zone's children does not flicker;
only drags that carry files count; the zone has `is-drop-over` while one is over it. `accepts(file, "image/*,.pdf")` is
the `<input accept>` check (FileUpload validates with it). Keep a click / keyboard way to choose files next to it.

## swipe — `march/behaviors/swipe`

"Follow the finger, then settle" gestures: sheets and drawers, pull to refresh, swipe to reply, story navigation.
`swipeable(el, opts)` listens on the element (pointer capture once the gesture is claimed); the helpers are the shared
physics.

```ts
import { swipeable, rubberBand, fling, nearest } from "march/behaviors/swipe";

swipeable(sheet, {
  axis: "y", accept: (p) => p.dy > 0,                       // claim only a downward swipe; anything else stays the page's
  onMove: (p) => follow(p.dy > limit ? limit + rubberBand(p.dy - limit) : p.dy),
  onEnd: (p) => settle(nearest([0, half, full], fling(pos, p.vy))),
});
```

| Option | | |
|---|---|---|
| `axis` | `"x"`, `"y"`, `"both"` (default) | the first clear movement (`threshold`, 6 px) locks the axis; the other one is left to scrolling |
| `accept(p)` | | veto when the axis is decided (`{ dx, dy, axis }`): wrong direction, content still scrollable … |
| `onPress(e)`, `ignore` | | per-press veto; targets that never start (form fields, buttons, links, sliders by default) |
| `onStart`, `onMove`, `onEnd(p, cancelled)` | | `p`: `{ dx, dy, di, axis, vx, vy, event }`; `di` along the writing direction, `vx` / `vy` px/ms over the last 100 ms |
| `onTap(e)`, `holdMs` + `onHold` / `onRelease` | | presses that never swiped: tap, or press and hold (StoryViewer pauses) |

`rubberBand(over, k = 4)` is the resistance past a limit, `fling(pos, v, ms = 160)` where a release comes to rest
(velocity capped), `nearest(points, target)` the snap point. The click that ends a mouse swipe is swallowed. Drawer,
PullToRefresh, ChatBubble (swipe to reply) and StoryViewer use it; `swipe()` in march/motion is the animation
gesture effect (direction events), not this.

## mask — `march/behaviors/mask`

An input mask on any `<input>`, for your own fields (TextInput has it as the `mask` prop):
`<input use:mask={"(999) 999 99 99"} />`, `<input use:mask={{ mask: cardNumber(), onChange: (raw) => …, placeholder: "eager" }} />`
or a signal of a mask (the mask changes with it). The engine is march/mask: caret-correct typing, Backspace over literals,
paste, `beforeinput` (Android), IME, its own undo / redo; `value: "raw" | "masked" | "parsed"` says what `onChange` gets;
`ref(ctl)` hands over the controller (`state()`, `set()`, `undo()`, `setMask()`). A refused character shakes the field
(`motion: false` or your own `(el) => …`). Pure helpers for tables, pipes and the server: `formatMask(value, mask)`,
`unmask(text, mask)`; presets in `march/mask/presets`, validators (Luhn, IBAN, TC kimlik, VKN, e-mail, URL, IP) in
`march/mask/validators`.

## dismiss — `march/behaviors/dismiss`

Close a light surface — popover, menu, picker, a `<details>` menu — on a press outside it or Escape:
`dismiss(panel, { inside: [trigger], onDismiss: (why) => close(why === "escape") })`. `inside` (elements or a getter)
adds what also counts as inside (the trigger, a panel in a portal); `on: "click"` waits for the click instead of the
pointerdown (a tap that scrolls does not close); `escape: false` leaves the key alone. Escape is taken in the capture
phase, so the innermost open surface closes before a dialog underneath sees it. Floating panels (Menu, Dropdown,
Tooltip, ContextMenu), Table menus and the chat reaction picker use it; modal dialogs keep their own stack.

