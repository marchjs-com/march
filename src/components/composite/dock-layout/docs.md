# DockLayout

An IDE workspace: split areas holding tab groups. Drag a tab to a **side** of a group (a new split), onto its **centre**
or **between two tabs** (a tab there), to an **edge** of the whole layout, or **out** of it (a floating window). An
animated preview shows where it will land. Groups maximize, panels minimize to a tray, and the layout is saved and loaded
as plain JSON. Each panel's content is rendered once and moves between groups without being rebuilt.

```tsx
<DockLayout panels={[
  { id: "files", title: "Files", icon: folder, content: () => <FileTree /> },
  { id: "editor", title: "main.ts", icon: fileText, content: () => <Editor />, dirty: () => $dirty },
  { id: "console", title: "Console", icon: terminal, content: () => <Console /> },
]} layout={{ row: [["files"], { column: [["editor"], ["console"]], share: .68 }], share: .26 }}
   persist="ide.layout" storage={storage().local} api={(a) => dock = a} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `panels` | `DockPanel[]` / accessor | — | `{ id, title, icon, content, closable, badge, dirty }`; a panel removed from the list leaves the layout |
| `layout` | `DockSpec` | every panel in one group | `["a", "b"]` a group; `{ row: [x, y], share }` / `{ column: [x, y], share }` a split |
| `persist` | string | — | save the layout under this key and load it on start |
| `storage` | `{ get, set }` | localStorage | sync or async; the Storage manager's areas (`storage().local`, `.idb`) fit |
| `commands` | string / `false` | `"dock"` | command id prefix: Reset layout, Focus next group, Maximize, Float, Minimize, Close, Show panel: … (palette, menus, toolbars) |
| `api` | `(api: DockApi) => void` | — | `state()`, `load`, `reset`, `open(panel, near?)`, `close`, `focus`, `move(panel, target, zone, index?)`, `float`, `dock`, `minimize`, `restore`, `toggleMaximize`, `active()` |
| `onChange` | `(state) => void` | — | after every change (also share and window moves) |
| `onClose` | `(panel) => boolean \| Promise` | — | return `false` to keep the panel (ask about unsaved changes) |
| `label` | string | "Workspace" | accessible name |
| `actions` | boolean / `("maximize" \| "float" \| "minimize")[]` | `true` | the buttons of a group, or only the listed ones (keyboard and `api` stay) |
| `tray` | boolean | `true` | the tray of minimized panels; with `false` bring them back with `api.restore(panel)` |
| `empty` | boolean / `(reset) => node` | `true` | what a layout without panels shows |
| `icons` | `{ close, maximize, restore, float, dock, minimize }` | — | own icons: an icon, a string or `() => node` |
| `motion` | boolean | `true` | the pop after a drop, the maximize transition, the ghost fade (the drop preview always follows the pointer) |
| `labels` | object | — | own texts: `workspace`, `panels`, `tray`, `close`, `maximize`, `restore`, `float`, `dock`, `minimize`, `moveWindow`, `resizeWindow`, `unsaved`, `empty`, `reset`, `layoutReset`, `group(title)`, `moved(title, zone)`, `minimized(title)`, `closed(title)` |
| `class` | class value | — | on the root (`hm-dock`) |

```tsx
<DockLayout panels={panels} actions={["maximize"]} tray={false} motion={false}
  icons={{ close: "×", minimize: () => <MyIcon /> }}
  labels={{ maximize: "Full size", closed: (title) => `${title} is gone` }}
  empty={(reset) => <Button onClick={reset}>Bring the panels back</Button>} />
```

The command titles of the palette come from the command manager's texts; `commands={false}` registers none. A tab's
icon, title, badge, dirty dot and close button are set per panel (`icon`, `title`, `badge`, `dirty`, `closable`).

`DockState` is `{ version: 1, root, floating, minimized, maximized }`: save it with `api.state()` and give it back with
`api.load(state)`; unknown panels are dropped when loading.

## Keyboard

| Key | |
|---|---|
| ← → (on the tab bar) | previous / next tab (Tabs; mirrored in RTL) |
| F6 / Shift+F6 | next / previous group |
| Alt+Shift+← → ↑ ↓ | dock the focused tab to that side of its group (a lone tab joins the neighbouring group) |
| Alt+Shift+Enter | maximize / restore the group |
| Alt+Shift+F | float / dock |
| Alt+Shift+M | minimize to the tray |
| Delete | close the tab |
| arrows on a window's grip / corner | move / resize a floating window (Shift: 40 px) |

## Accessibility

A region with its own name; every group is a `section` named after its active panel and holds a Tabs tablist. Every
pointer action has a keyboard path (table above) and the group buttons have names and `aria-keyshortcuts`. Moves,
minimizing and closing are announced in a polite live region. Start and end follow the writing direction: in RTL the
start side is on the right, the arrows and the drop zones are mirrored. Narrow layouts stack side-by-side splits.

## Composed of

Splitter (every split; horizontal or vertical, RTL aware), Tabs (every group), Portal (each panel's content lives in a
Portal and moves between PortalTargets; the drag ghost is a drag layer). Motion engine for the drop preview, the drop
and the maximize FLIP; command manager for the palette.
