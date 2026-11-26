# SunburstChart

A hierarchy as rings: the top level around the middle, each level one ring further out, every arc as wide as its
value. Branches take the series colors, their children lighter shades of them. Click a node (or Enter on it) to zoom
in: its span opens to the full circle and the levels below follow; the middle, Escape, Backspace or the breadcrumb
path go back up. Labels appear on arcs wide enough to hold them.

```tsx
<SunburstChart data={$budget} value="amount" format={["money", "TRY"]} title="Budget" />
<SunburstChart data={disk} label="name" value="size" format="bytes" maxDepth={4} innerRadius={0.2} />
<SunburstChart data={org} childrenOf="team" label="name" id="id" drill={false} labels={false} onSelect={(p) => open(p.datum)} />
```

## Props

| Prop | |
|---|---|
| `data` | One root row or a list of top rows; each row has `children` or a value. A signal or a function works too. |
| `childrenOf` / `value` / `label` / `id` | How to read a row: keys or functions. Defaults `children`, `value`, `label` (then `name`) and the path of labels. |
| `maxDepth` | Levels shown at once below the zoomed node. Default 3. |
| `innerRadius` | The middle as a share of the radius 0…0.8. Default 0.3. |
| `padAngle` | Gap between arcs in radians. Default 0.006. |
| `labels` | Names on arcs wide enough (along the arc, or across it on narrow deep arcs). Default true. |
| `drill` | Click / Enter on a node with children zooms into it. Default true. |
| `breadcrumbs` | The path over the chart (March `Breadcrumbs`; a crumb with siblings opens a menu of them). Default true. |
| `rootLabel` | Name of the whole tree in the middle and the path. Default "All" or the root row's label. |
| `center` | The middle: default the zoomed node's name and value; any value, `(node) => content`, or `false`. |
| `format` | Value format: a pipe name, `[pipe, ...args]` or a function. |
| `tooltip` | `true` (default), `false` or `(node) => content`. Node: `{ key, label, value, depth, path, share, total, hasChildren, datum }`. |
| `onSelect` | Called with the node on click or Enter / Space (before it zooms). |
| `focus` / `onDrill` | Key of the node zoomed into from outside / called with the new zoomed node after a drill (null at the top). |
| `animate` | `true` (default spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` (stagger: ring by ring) or `(ctx) => …`. |
| `legend` | `true`, `false`, "bottom" or "right"; shown with two top branches or more. Items toggle branches. |
| `title` / `description` / `empty` / `colors` / `width` / `height` / `class` / `export` | Accessible name and description, no-data content, per-branch colors, size, extra class, export buttons. |

Class hooks: `m-sunburst-node` (with `data-label`, `m-sunburst-parent` on nodes with children), `m-sunburst-arc`,
`m-sunburst-label`, `m-sunburst-center`, `m-sunburst-center-label`, `m-sunburst-center-value`, `m-sunburst-crumbs`;
`--m-sb-mix` is how much of the branch color a level keeps.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists every node with its path, value and share.
- Tab reaches the chart; ← → move along a ring, ↓ goes to the first child, ↑ to the parent, Enter / Space selects and
  zooms in, Escape / Backspace zoom out (Escape at the top clears). The tooltip follows the keyboard node, which is
  outlined while the nodes off its path dim.
- The path is a `nav` of buttons (March `Breadcrumbs`); legend items are toggle buttons with `aria-pressed`.

## Motion

- Enter: on the first draw the arcs open from 12 o'clock around the circle, ring after ring with `stagger`; later
  nodes open from their own start; after a zoom new levels come out of the outer edge.
- Update: on a zoom every arc tweens to its new angles and radii (the chosen node's span opens to the full circle);
  on new data the arcs turn to their new angles.
- Exit: nodes that drop out of view slide off with the zoom, removed nodes close on their middle, before they go.
- `animate={false}` or reduced motion: arcs take their places at once.
