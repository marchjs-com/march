# PhotoEditor

A complete photo editor: the familiar workflows and habits of a professional image editor (layers, masks, selections,
a toolbox with tool groups, menus with the usual shortcuts, dockable panels, history), built on March's headless
document core `march/image/doc` and the `march/image` engine (every adjustment and filter is an engine op). Its own
entry: pages that do not show it never load it.

```tsx
import { PhotoEditor } from "march/photo-editor";

<PhotoEditor documents={[file]} workspace="photography" onSave={(bytes, doc) => upload(bytes)} api={(ed) => (editor = ed)} />
// scripting
editor.api.doc?.layers.add("Notes");
editor.run("image.autoTone");
```

## What is inside

- **Document** (`march/image/doc`): tiled 8 / 16 / 32-bit layers; pixel, text, shape, fill, adjustment, group, smart
  object and artboard layers; opacity, fill, 27 blend modes, pass-through groups, locks, color tags, layer masks,
  vector masks, clipping masks, Blend If, knockout, layer styles (shadows, glows, bevel, satin, overlays, stroke);
  channels, paths, guides, grid, slices, notes, counts, color samplers; history with snapshots and a memory cap;
  `.march-image` files (lossless), PSD (`march/image/psd`), PNG / JPEG / WebP / AVIF / TIFF / SVG export.
- **Tools**: move, artboard, marquees, lassos (free, polygonal, magnetic), object / quick selection, magic wand,
  crop, perspective crop, slice, eyedropper, color sampler, ruler, note, count, spot healing, healing, patch,
  content-aware move, red eye, brush, pencil, color replacement, mixer brush, clone and pattern stamp, history and
  art history brush, erasers, gradient, paint bucket, blur, sharpen, smudge, dodge, burn, sponge, pens and anchor
  tools, path selection, type (horizontal, vertical, masks), shapes, hand, rotate view, zoom. Tools are headless
  (`march/image/doc` › tools): any UI can drive them.
- **Brush engine**: round, image and procedural tips, texture, dual tip, size / angle / roundness / scatter / color /
  opacity dynamics from pressure, tilt, twist and direction, smoothing with a lazy rope, wet edges, airbrush,
  symmetry (mirror, radial, mandala), 31 presets, `.abr` import.
- **Workspace**: menu bar (File, Edit, Image, Layer, Type, Select, Filter, View, Plugins, Window, Help), tool options
  bar, toolbar with long-press flyouts, documents as tabs or floating windows, dockable panels (Layers, Channels,
  Paths, History, Adjustments, Properties, Color, Swatches, Gradients, Patterns, Brushes, Character, Paragraph,
  Histogram, Navigator, Info, Actions, Glyphs, Comments), saved workspaces, status bar (zoom, size, memory), rulers,
  guides, smart guides, grid, pixel grid, context menus, command palette, screen modes, Tab hides the panels.
- **Pro extras**: color management (profiles, soft proof, gamut warning), artboards and Export As, variables and
  CSV data sets, actions (record, play, batch), plugins (tools, panels, filters, commands), collaboration (live
  cursors, layer comments, versions), AI hooks (generative fill, object select, sky, neural filters).

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `documents` | `(DocInit \| Blob \| Uint8Array \| ImageDocument)[]` | — | documents to open: sizes, image files, `.march-image` / PSD bytes, ready documents |
| `sample` | boolean | `true` | open a generated sample picture when no document is given |
| `workspace` | `"essentials"` \| `"photography"` \| `"painting"` \| `"design"` | `"essentials"` | the panel arrangement |
| `tools` | `string[]` | all | the tools the toolbar shows |
| `panels` | `string[]` | all | the panels that exist |
| `menu`, `optionsBar`, `toolbar`, `statusBar`, `dock`, `workspaceSwitcher` | boolean | `true` | each part on or off |
| `motion` | boolean | `true` | the interface's animations (panels, tool switching, handles, ants, reorders, dialogs); reduced motion is honored |
| `uiColor` | `"dark"` \| `"darker"` \| `"medium"` \| `"light"` | `"dark"` | interface brightness |
| `prefs` | `Partial<Prefs>` | — | preferences to start with (units, history, cursors, checkerboard, keys…) |
| `plugins` | `Plugin[]` | — | `{ id, name, setup(api) }`: `api.addTool`, `addPanel`, `addFilter`, `addCommand`, `on` |
| `ai` | object | — | hooks: `selectObject`, `generativeFill`, `sky`, `neural` |
| `height` | CSS length | `100%` | |
| `onSave` / `onExport` / `onChange` | functions | — | file bytes on save, exported files, every change |
| `api` | `(editor) => void` | — | the `Editor` controller (documents, tools, commands, `api` scripting facade) |
| `labels` | object | — | own texts |
| `class` | class | — | on the root (`.m-pe`) |

## Keyboard

The familiar single keys pick tools (V, M, L, W, C, I, J, B, S, Y, E, G, O, P, T, A, U, H, R, Z; Shift + key cycles
the group), D / X reset and swap colors, Q quick mask, F screen mode, Tab hides the panels, [ ] brush size,
Shift + [ ] hardness, 0–9 opacity, Ctrl+J layer via copy, Ctrl+T free transform, Ctrl+G group, Ctrl+E merge down,
Ctrl+Shift+N new layer, Ctrl+D deselect, Ctrl+Shift+I inverse, Ctrl + / Ctrl − / Ctrl+0 / Ctrl+1 zoom, Alt-click
source points, Space pans. Every command is in the menus and in the command palette (Ctrl+F); every shortcut can be
remapped (Edit › Keyboard Shortcuts).

## Accessibility

The menu bar is a `menubar`; the toolbar, the options bar and every panel are keyboard complete with roving focus;
the canvas is an `application` region with its document and zoom in its name; tool, layer and history changes are
announced; high contrast mode; Turkish and English texts.

## Composed of

MenuBar, TabList, DockLayout, StatusBar, Window (floating documents), IconButton, Button, Segmented, NumberInput,
Slider, Select, Toggle, ColorInput, TextInput, Swatch, ListRow, Kbd, Popover, Menu, ContextMenu, Empty, Spinner,
Dialog, CommandPalette; panels and dialogs compose ColorPicker, GradientEditor, FontPicker, PropertyGrid, TreeView,
Disclosure and the form controls.
