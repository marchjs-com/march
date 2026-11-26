# SankeyChart

Flows between nodes: each link `{ source, target, value }` is a ribbon as wide as its value, nodes stand in columns
(by their longest path from a source) and a few relaxation passes order them to cross as little as possible. Hover a
node to light its whole flow upstream and downstream, or a ribbon to light that one link.

```tsx
<SankeyChart links={$flows} format={["money", "TRY"]} title="Where the money goes" />
<SankeyChart links={funnel} nodes={steps} nodeLabel="name" align="left" linkColor="source" nodePadding={20} />
<SankeyChart links={energy} linkColor="neutral" valueLabels={false} onSelect={(p) => p.kind === "node" && focus(p.key)} />
```

## Props

| Prop | |
|---|---|
| `links` | Link rows (an array, a signal or a function). `source` / `target` / `value` say how to read them (keys or getters; defaults the same names). |
| `nodes` | Optional node rows with `nodeId` (default "id") and `nodeLabel` (default `label`, then `name`, then the id). Ids only named by links are added. |
| `align` | "justify" (default: sinks in the last column), "left", "right" or "center". |
| `nodeWidth` / `nodePadding` | Node width (14) and the vertical gap between nodes of a column (14), in px. |
| `iterations` | Relaxation passes toward fewer crossings (6; 0 keeps the input order). |
| `linkColor` | "gradient" (default, source color to target color), "source", "target" or "neutral". |
| `labels` / `valueLabels` | Node names (right of the nodes in the left half, left of the others) / the node's value after its name. |
| `format` | Value format: a pipe name, `[pipe, ...args]` or a function. |
| `tableLabels` | Headers of the hidden data table: `{ source, target, value }`. |
| `legend` | `true`, "bottom" or "right": one toggle per node (hiding a node hides its links). Off by default. |
| `tooltip` | `true` (default), `false` or `(point) => content`. Point: `{ kind, key, label, value, incoming, outgoing, source, target, datum }`. |
| `onSelect` | Called with the clicked / Enter-pressed node or link. |
| `animate` | `true` (default spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `title` / `description` / `empty` / `colors` / `width` / `height` / `class` / `export` | Accessible name and description, no-data content, per-node colors (in node order), size, extra class, export buttons. |

Class hooks: `m-sankey-node`, `m-sankey-label`, `m-sankey-value`, `m-sankey-flow`, `m-sankey-link`, `m-sankey-on`
(lit by hover), `m-sankey-focus` (on the plot while something is lit). `--m-sankey-link-opacity` sets the ribbon tint.

## Accessibility

- The SVG has a title and description; a visually hidden table lists every link (source, target, value).
- Tab reaches the chart; arrows walk the nodes (column by column, top down) and then the links; Enter / Space
  selects, Escape clears. The tooltip and the flow highlight follow the keyboard; the focused mark wears a ring.

## Motion

- Enter: nodes slide in from their outer side and fade in; ribbons draw from their source to their target (with
  `stagger`, link after link in column order).
- Update: node heights and positions and ribbon ends and widths morph to the new values.
- Exit: leaving ribbons thin out and leaving nodes collapse into their middle before they are removed.
- `animate={false}` or reduced motion: everything takes its place at once.
