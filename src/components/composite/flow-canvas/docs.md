# FlowCanvas

A node editor on an endless canvas: pan and zoom, snap to the grid, nodes with ports and form fields, bezier edges,
values flowing along the edges as moving dots, box and multi selection, copy / paste, undo, a minimap, layered auto
layout, groups, a context menu and full keyboard use. The flow lives in a store (`createFlow`) that FlowPalette adds
to and FlowControls runs; it reads and writes a readable JSON schema (`march.flow/v1`).

```tsx
const flow = createFlow({ types, doc })          // types: [{ type, label, icon, color, inputs, outputs, fields, run }]
<FlowCanvas flow={flow} snap={16} minimap />
flow.toJSON()                                     // { schema: "march.flow/v1", nodes, edges: [{ from: "hook.out", to: "check.in" }], groups }
flow.load(JSON.parse(text), "Import")             // validated (validateFlow); one undo step
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `flow` | `FlowStore` | — | from `createFlow({ types, doc?, undo? })` |
| `snap` | number | `16` | grid step (world px) for snapping and the dotted background; `0` turns snapping off |
| `minimap` | boolean | `true` | minimap in the inline-end corner (hidden on narrow canvases) |
| `tool` | `select` `pan` | `select` | dragging the empty canvas draws a selection box or moves the view |
| `fields` | boolean | `true` | form controls inside the nodes |
| `label` | string | "Flow editor" | accessible name |

## Model

`createFlow({ types, doc })` returns a `FlowStore`: `nodes`, `edges`, `groups`, `viewport`, `selection` (signals),
`addNode`, `connect` (no cycles, matching port sides), `remove`, `moveBy`, `group`, `ungroup`, `copy`, `paste`,
`toJSON`, `load`, `change(label, fn)` (one undo step) and the run state FlowControls writes (`status`, `errors`,
`counts`, `pulse`). Every change is a step in the app's UndoManager. A node type's `run(ctx)` returns a value for
all outputs, `emit({ port: value })` to choose outputs, or throws to fail.

Helpers: `validateFlow(doc, types)` (readable problems), `layeredLayout`, `boundsOf`, `edgePath`, `portPoint`,
`Minimap`.

## Keyboard

Tab to a node or port. Enter on a port, then Enter on another connects them. Arrow keys move the selection one grid
step (Shift: four), or pan with nothing selected. Delete removes; Ctrl/⌘ + A, C, X, V, D, Z, Shift+Z, G, Shift+G;
`+` / `−` zoom, `0` fits, Shift+L arranges. Space + drag pans. Shift+F10 or the Menu key opens the context menu.

## Accessibility

The canvas is an `application` region with a roledescription; nodes are focusable groups that announce their run
state; ports are buttons named "Input …" / "Output …"; edge counters are buttons naming both ends and the count.
Selections, connections, pastes and layout are announced in a polite live region. Reduced motion: no draw-in, no
moving dots, no glow; the counters still count.

## Composed of

ContextMenu (context menu), IconButton (zoom bar), OverflowText (titles), Field + TextInput / NumberInput / Select /
Toggle (node fields), ClipboardManager and UndoManager, the motion engine (draw-in, dots, glow, shake, layout tween).
