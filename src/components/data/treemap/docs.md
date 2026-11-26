# Treemap

A hierarchy as nested rectangles: each tile's area is its value, groups carry a header with their tiles inside.
Click a group (or Enter on it) to zoom in: its tile grows to the whole chart and its children lay out again; the
breadcrumb row, a click on the background, Escape or Backspace go back up. Color by branch (the series palette) or
by a number of each row through a color scale.

```tsx
<Treemap data={$budget} value="amount" format={["money", "TRY"]} title="Budget" />
<Treemap data={files} depth={3} padding={1} radius={2} labels={false} onSelect={(p) => open(p.datum)} />
<Treemap data={stocks} colorValue="change" colorScale="diverging" colorMid={0} format="compact" colorFormat="percent" />
```

## Props

| Prop | |
|---|---|
| `data` | One root row or a list of top rows; each row has `children` or a value. A signal or a function works too. |
| `childrenOf` / `value` / `label` / `id` | How to read a row: keys or functions. Defaults `children`, `value`, `label` (then `name`) and the path of labels. |
| `depth` | Levels drawn below the current root: 1 = flat tiles, 2 (default) = groups with a header and tiles inside. |
| `colorValue` | Color tiles by this number of their row through `colorScale` instead of by branch. |
| `colorScale` | "sequential" (default), "diverging", or two / three colors or tokens. `colorMid`: the middle of a diverging scale. |
| `colorLegend` / `colorFormat` | The small color scale under the chart (default on with `colorValue`) and the format of its ends. |
| `format` | Value format: a pipe name, `[pipe, ...args]` or a function. |
| `labels` / `valueLabels` | Names on tiles and headers / the value under each name. A label that does not fit its tile is hidden. |
| `padding` / `radius` / `headerHeight` | Gap between tiles (2), corner radius (4), group header height (20), in px. |
| `drill` | Click / Enter on a group zooms into it (default true). |
| `breadcrumbs` / `rootLabel` | The crumb row over the chart (a March `Breadcrumbs`, default on) and its first crumb ("All"). |
| `focus` / `onDrill` | Key of the node shown as the root (drill from outside) / called with the new root after a drill (null at the top). |
| `legend` | `true`, "bottom" or "right": one toggle per top-level branch (off by default: the tiles carry the names). |
| `tooltip` | `true` (default), `false` or `(point) => content`. Point: `{ key, label, value, share, depth, path, leaf, datum, node }`. |
| `onSelect` | Called with a leaf on click or Enter / Space (a group drills instead). |
| `animate` | `true` (default spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `title` / `description` / `empty` / `xLabel` / `yLabel` / `colors` / `width` / `height` / `class` / `export` | Accessible name and description, no-data content, table headers, per-branch colors, size, extra class, export buttons. |

Class hooks: `m-treemap-tile`, `m-treemap-leaf`, `m-treemap-group`, `m-treemap-root`, `m-treemap-label`,
`m-treemap-value`, `m-treemap-header`, `m-treemap-crumbs`, `m-treemap-scale`.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists every node with its path and value.
- Tab reaches the chart; arrows move between tiles (groups, then their tiles), Enter / Space selects a leaf or zooms
  into a group, Escape / Backspace go up a level (Escape at the top clears). The tooltip follows the keyboard tile,
  which wears a visible ring.
- The breadcrumb row is a `nav` of buttons; the current level is marked `aria-current`.

## Motion

- Enter: tiles grow out of their centers (with `stagger`, one after another in drawing order).
- Update: on new data, a drill or a resize every tile glides to its new rectangle; on a drill the group's tile grows to
  the whole chart while its children spread out inside it, going up reverses it.
- Exit: tiles that leave shrink into their centers before they are removed.
- `animate={false}` or reduced motion: tiles take their places at once.
