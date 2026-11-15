# DockLayout

An IDE workspace, the dock of march-app-ui (after HADİ Studio Kit): tab groups in rows and columns. Drag a tab to a
**side** of a group (a new split), onto its **centre** or **between two tabs** (a tab there), or to the **outer edge** of
the whole layout. Closing never deletes: the group **collapses to a strip** (vertical in a row, horizontal in a column)
and gets its size back when opened. Groups fill the whole area, layouts come from presets and are saved as plain JSON.
Panels never move in the DOM: an iframe keeps running, an editor keeps its state.

```tsx
<DockLayout panels={[
  { id: "files", title: "Files", icon: folder, min: [150, 120], content: () => <FileTree /> },
  { id: "editor", title: "main.ts", icon: fileText, content: () => <Editor />, dirty: () => $dirty },
  { id: "console", title: "Console", icon: terminal, content: () => <Console /> },
]} presets={{ main: { title: "Main", tree: () => row([.26, tabs("files")], [.74, col([.68, tabs("editor")], [.32, tabs("console")])]) } }}
   persist="ide.layout" api={(a) => dock = a} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `panels` | `DockPanel[]` / accessor | — | `{ id, title, icon, content, min: [w, h], place, closable, badge, dirty, onShow }`; the list may change (a new panel goes to its `place`, a removed one leaves the tree) |
| `presets` | `{ [name]: { title, tree } }` | — | ready-made layouts written with `row([weight, child], …)`, `col(…)`, `tabs(ids, { collapsed })`; the first is the default |
| `preset` | string | first | the default preset |
| `layout` | tree | first panel, others at their `place` | the default without presets |
| `persist` | string | — | keep the layout and saved layouts under this key |
| `storage` | `{ get, set }` | localStorage | sync or async (the Storage manager's areas fit) |
| `commands` | string / `false` | `"dock"` | palette commands: Reset layout, Open all panels, Layout: (each preset) |
| `api` | `(api: DockApi) => void` | — | `layout()`, `open`, `focus`, `collapse`, `close`, `toggleMaximize`, `focusMode` / `unfocus`, `preset`, `reset`, `expandAll`, `isOpen`, `load`, `layoutMenu()` |
| `onChange` | `(layout) => void` | — | after every change |
| `onClose` | `(panel) => boolean \| Promise` | — | a closable tab's close mark: remove the panel from `panels`; `false` keeps it |
| `actions` | boolean / `("menu" \| "maximize" \| "collapse")[]` | `true` | the buttons of a group; without "collapse" the panel menu cannot collapse either (`api` still can) |
| `narrow` | number | `560` | below this width: one tab group, no drag |
| `motion` | boolean | `true` | the short slide when the layout changes |
| `icons` | `{ menu, maximize, restore, collapse }` | — | own icons |
| `labels` | `{ menu, maximize, restore, collapse, panels, strip }` | — | own texts |
| `label` | string | "Workspace" | accessible name |
| `class` | class value | — | on the root (`m-dock`) |

`place` says where a panel the layout does not know goes: `{ near: "editor", zone: "left" | "right" | "top" | "bottom" |
"center", size: .3, collapsed }`. A saved layout drops unknown panels and adds missing ones at their place.

## Keyboard

| Key | |
|---|---|
| ← → Home End (tab bar) | previous / next tab (TabList) |
| Ctrl+Shift+← → | move the tab in its group |
| Delete | close a closable tab |
| Shift+F10 / Menu key | the panel menu: move, dock to an edge, join another group, collapse, fill, reset |
| arrows on a splitter | resize (Shift: 4 steps); Enter / double click: equal sizes |

A dragged splitter snaps to the line of another splitter of the same direction when it comes within 10 px: edges line
up across columns and rows.

## Accessibility

A group named "Workspace"; every group holds a TabList and its panels are `tabpanel`s named by their tab. Splitters
are separators with a value and a name ("Splitter: Files / Editor"). Strips are buttons that open their panel. Every
pointer action has a keyboard or menu path.

## Composed of

TabList (every group's tabs: icon, title, badge, "changed" dot, close mark, roving focus), IconButton (the group's menu,
maximize — a `pressed` toggle — and collapse), Button (the entries of a strip), ResizeHandle (every splitter: pointer,
arrows, Enter), the shared menu panel of Menu (panel and layout menus) and dragGhost (the drag layer).
