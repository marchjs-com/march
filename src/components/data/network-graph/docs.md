# NetworkGraph

Who is connected to whom: nodes and the links between them, laid out by a force simulation (or on a circle or a
grid). Node size follows `value` (or the number of links), color follows `group`; the legend toggles groups. Drag a
node to move it (it stays pinned; double click releases it), drag the background to pan, wheel or pinch to zoom.

```tsx
<NetworkGraph nodes={$people} links={$follows} group="team" value="posts" directed title="Takip ağı" />
<NetworkGraph links={edges} layout="circle" labels="hover" onSelect={(n) => open(n.id)} />
<NetworkGraph nodes={$deps} links={$imports} charge={-260} linkDistance={80} nodeSize={[4, 22]} />
```

## Props

| Prop | |
|---|---|
| `nodes` | Node rows (array, signal or function). Without it the nodes come from the links. |
| `links` | Link rows with a source and a target id. |
| `id` / `label` / `group` / `value` | Node fields: keys or getters. Defaults "id", "label" (else the id), "group", "value" (else the number of links). |
| `source` / `target` / `weight` | Link fields. Defaults "source", "target", "value" (thickness and pull). |
| `layout` | "force" (default), "circle" or "grid"; nodes glide between layouts. |
| `charge` | Repulsion between nodes (negative pushes apart). Default -160. |
| `linkDistance` / `linkStrength` | Rest length of a link (default 60 px) and its stiffness 0…2 (default 1). |
| `center` | Pull towards the middle, 0…1. Default 0.06. |
| `collide` | Nodes do not overlap: `true` (3 px apart, default), `false` or the gap in px. |
| `nodeSize` | Smallest and largest radius in px. Default `[5, 16]`. |
| `labels` | `true` (default up to 60 nodes), `false` or "hover" (the hovered node and its neighbours). |
| `directed` | Arrows at the target end of the links. |
| `zoom` | Wheel / pinch zoom and background pan (default true); double click, `0` or "Reset view" fits again. |
| `draggable` | Nodes can be dragged and pinned. Default true. |
| `groupLabels` | Legend and tooltip names of the groups: `{ group: "Name" }`. |
| `format` | Value format: a pipe name, `[pipe, ...args]` or a function. |
| `tooltip` | `true` (default), `false` or `(node) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed node (`{ id, label, group, value, degree, neighbors, datum }`). |
| `animate` | `true` (spring, default), `false` (the layout is computed at once), an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `title` / `description` | Accessible name (SVG title, table caption) and longer description. |
| `legend` / `empty` / `colors` / `width` / `height` / `class` / `export` | Legend (groups), no-data content, per-group colors, size (default height 360), extra class, export buttons. |

Class hooks: `m-network-node`, `m-network-dot`, `m-network-ring`, `m-network-label`, `m-network-link`,
`m-network-near` (hovered node, its neighbours and links), `m-network-pinned`, `m-network-bg`.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists every node with its group, value and
  number of links.
- Tab reaches the graph; the arrows go to the nearest node in that direction, Home / End to the first / last node,
  Enter selects, Escape clears (a second Escape fits the view); `+` / `-` zoom, `0` resets.
- The keyboard node is ringed and its neighbours light up, like on hover; the tooltip follows it.

## Motion

- The simulation runs on the motion engine's clock (`onFrame`): global speed and "pause all" reach it, and it stops by
  itself when the layout cools. With `animate={false}` or reduced motion the layout is computed at once.
- Enter: nodes pop in from the middle (scale and fade, `stagger` one after another) and the links fade in.
- Update: kept nodes keep their positions and the simulation warms up again; new sizes ease in; layout changes glide;
  the view eases to fit the graph when it comes to rest.
- Exit: leaving nodes shrink and fade, leaving links fade, before they are removed.
