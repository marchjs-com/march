# ThreadNav

An app's navigation drawn as a thread at the side of the screen. The sections are beads on the thread; near the
pointer it magnifies like a dock and the thread bends toward the pointer. A bead opens a capsule beside it: a search
and the section's categories, plain text with a count. The open category's pages hang from it on a second thread. A
drop marks where you are and flows to a new place in the colour of its section. While the capsule is closed, a small
capsule shows the path (section › category › page) with the same beads; a bead there opens the capsule at that level.

```tsx
<ThreadNav items={sections} value={$page} onNavigate={(it) => go(it.href)} fixed />
<ThreadNav items={sections} value={$page} onNavigate={(it) => $page = it.id} search={false} crumbs={false} />
```

Each item: `{ id, label, desc?, count?, color?, href?, children? }`. The top level are the sections (the beads), their
children the categories (the capsule), theirs the pages (the second thread). An item with `href` is a link. `desc` is
shown under the capsule while the row is pointed at or focused, so the list itself stays one line per row. `color` (a
colour token) is a section's: the drop and the capsule take it. `threadPath(items, id)` gives the path to an item.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `ThreadNavItem[]` / accessor | | sections › categories › pages |
| `value` | `string` / accessor | | the id of where you are (a page, a category or a section) |
| `onNavigate` | `(item, path) => void` | | a page (or an item without children) was chosen |
| `fixed` | `boolean` | `false` | at the start edge of the screen; otherwise it fills its place |
| `magnify` | `boolean` / accessor | `true` | the dock magnifier on the beads |
| `reach` | `number` / accessor | `120` | how far the magnifier reaches, px |
| `grow` | `number` / accessor | `22` | room a fully magnified bead takes beyond its step, px |
| `bend` | `boolean` / accessor | `true` | the thread bends toward the pointer and trembles back (not under reduced motion) |
| `search` | `boolean` / accessor | `true` | a search at the top of the capsule: it filters categories and pages, matches open |
| `crumbs` | `boolean` / accessor | `true` | while closed, the path to where you are in a small capsule |
| `closeOnNavigate` | `boolean` | `true` | close the capsule once a place is chosen |
| `labels` | `{ group?, search?, close?, empty? }` | translated | own names |
| `class` | class value | | |

CSS tokens: `--m-thn-step` (room per bead), `--m-thn-rail` (the rail's width).

## Accessibility

The rail is a `nav` ("Navigation") with one tab stop: the bead of where you are. Up and Down move between the beads;
Right, Enter or Space opens the capsule and goes into it. In the capsule Up and Down move through the rows, Right opens
a category, Left goes back (a page to its category, a category to the rail), Escape closes and returns to the bead.
Where you are has `aria-current`; a bead with a capsule has `aria-expanded`. Focusing a bead magnifies around it.
Under reduced motion the thread stays straight and the drop does not stretch.

## Performance

The magnifier changes no size (the beads move and scale), the thread is one SVG path drawn only while it moves, the drop
is placed from layout offsets and follows its bead's shift. Shares its magnifier with SectionTimeline (march/ui
dock-lens).
