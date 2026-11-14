# TreeView

A tree for large hierarchies. Only the rows in view are in the DOM (shared virtual window), so thousands of open nodes
stay smooth. Children can load lazily the first time a folder opens, selection is single or multiple, nodes move by
drag and drop (before / after / inside, with edge auto-scroll and auto-open of a folder you hover), and search keeps
the path to every hit open and highlights the matching text. For a short static tree, `<Tree>` is enough.

```tsx
import { TreeView } from "hadi-march/components/data/tree-view";

<TreeView nodes={files} selection="multiple" draggable search={$q}
  load={(node) => api.children(node.id)}
  onSelect={(ids) => $selected = ids}
  onMove={(ids, target, position) => api.move(ids, target, position)} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `nodes` | `TreeViewNode[]` / accessor | — | `{ id, label, icon?, meta?, children?, lazy?, disabled?, data? }`; an accessor replaces the tree when it changes |
| `load` | `(node) => Promise<TreeViewNode[]>` | — | children of a `lazy` node, loaded once; a failure shows Retry |
| `selection` | `single` `multiple` `none` (or an accessor) | `single` | live: a narrower mode trims the selection at once |
| `selected` | `string[]` | — | initially selected ids |
| `onSelect` | `(ids, nodes) => void` | — | |
| `expanded` | `string[]` | — | initially open ids (a lazy folder among them loads at once) |
| `onExpand` | `(id, open) => void` | — | |
| `search` | string / accessor | — | shows the hits and their path, highlighted (loaded nodes only) |
| `draggable` | boolean / accessor | `false` | drag and drop (rows show a grab cursor); Alt+↑ / Alt+↓ moves a node among its siblings |
| `canDrop` | `(ids, target, position) => boolean` | — | refuse a drop (a node never drops into itself) |
| `onMove` | `(ids, targetId, position) => void` | — | after a move; the tree already shows it |
| `onActivate` | `(node) => void` | — | Enter / double-click on a leaf |
| `height` | px | `360` | |
| `rowHeight` | px | `32` | |
| `icons` | boolean / accessor | `true` | folder / file icons for nodes without their own |
| `chevron` | boolean / `(node, open) => node` | `true` | the open / close arrow, off (double click and the keyboard still open rows), or your own |
| `empty` | boolean / node | `true` | the empty state: the text of `labels`, off, or your own node |
| `ghost` | `(nodes) => node` | first label + count | content of the drag ghost |
| `labels` | `{ loading?, retry?, empty?, noMatch? }` | built-in texts | your own texts; `loading(label)` and `noMatch(query)` are functions |
| `animate` | boolean | `true` | opening, landing and ghost animations |
| `m:color` | ColorToken | the accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `label` | string | "Tree" | accessible name |
| `class` | class | — | extra class on the tree |

```tsx
<TreeView nodes={files} m:color="brand-purple" animate={false}
  chevron={(node, open) => (open ? "−" : "+")}
  labels={{ retry: "Try again", empty: "No files yet", noMatch: (q) => `No file named "${q}"` }}
  ghost={(nodes) => <b>{nodes.length} files</b>} />
```

Shared pieces it uses: `createAxis` / `createViewport` (core/virtual), `createSelection` / `moveCursor`
(core/selection), `pointerDrag` (hadi-march/motion), `markText` (ui/mark) and `matchRanges` (core/text), the drag layer
(`openLayer("drag")`).

## Accessibility

`role="tree"` with `aria-multiselectable`; rows are `treeitem`s with `aria-level`, `aria-setsize`, `aria-posinset`,
`aria-expanded`, `aria-selected` and `aria-busy` while loading. One tab stop; the cursor row is announced through
`aria-activedescendant`. Keys: ↑ ↓ Home End PageUp PageDown move, → opens / goes to the first child, ← closes / goes
to the parent (mirrored in RTL), Enter selects and opens or activates, Space selects (toggles in multiple mode),
Shift+arrows extend, Ctrl+A selects all, `*` opens the siblings, typing jumps to a matching label, Alt+↑ / Alt+↓
moves. Opening animates the new rows and a dropped node settles with a spring, on the motion engine (reduced motion and
global pause apply).

## Composed of

ListRow (the row) and Chevron (the arrow), built by the row Tree and TreeView share (`tree/row.ts`: one row, one set of keys); Spinner (loading rows), Button (retry), Empty (no nodes / no match) and Badge (the count on the drag ghost). The ghost is the shared `dragGhost`.
