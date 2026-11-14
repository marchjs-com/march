# Tree

An expandable tree for small hierarchies (file lists, settings sections). Every node can carry an icon and a trailing
meta text; long labels scroll with OverflowText instead of ending in an ellipsis. For thousands of nodes, lazy
children or drag and drop use TreeView.

```tsx
<Tree label="Files" nodes={files} expanded={["src"]} selected={() => $file} onSelect={(n) => { $file = n.id }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `nodes` | `{ id, label, icon?, meta?, children? }[]` | — | the tree |
| `expanded` | `string[]` | `[]` | ids open at start |
| `selected` | id / accessor | — | selected node |
| `onSelect` | `(node) => void` | — | click / Enter / Space |
| `label` | string | "Tree" | accessible name |
| `chevron` | boolean / `(node, open) => node` | `true` | the open / close arrow, off, or your own (`open()` is live) |
| `m:color` | ColorToken | the accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `class` | class | — | extra class on the tree |

```tsx
<Tree nodes={files} color="brand-purple" chevron={(node, open) => <span>{() => (open() ? "−" : "+")}</span>} />
<Tree nodes={files} chevron={false} />
```

## Accessibility

`role="tree"` with `treeitem`, `group`, `aria-level`, `aria-expanded` and `aria-selected`. One row is in the Tab order
(roving focus): ↑ ↓ Home End move among visible rows, → opens (then goes to the first child), ← closes (then goes to the parent; the two swap in right-to-left), Enter or Space selects. The chevron turns
on the motion engine's duration tokens and the indent uses logical properties (RTL mirrors).

## Composed of

ListRow (the row), Chevron (the arrow) and OverflowText (long labels). The row and the keys are shared with TreeView and TreeEditor (`tree/row.ts`: `treeRow`, `treeKey`, and `treeListKey` for a tree drawn as one flat list).
