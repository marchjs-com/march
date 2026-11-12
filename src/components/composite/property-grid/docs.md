# PropertyGrid

An inspector: property rows in collapsible groups, a search field, and for each property the form control of its type.
Every change is an **undo step** in the app's Undo history (typing in one field merges into one step), unsaved changes
are registered with **DirtyState** (leave warning, `saveAll()`), and changed rows are marked and can be reset one by
one. The footer counts the changes and offers Revert and Save.

```tsx
<PropertyGrid label="Card" bind:value={$card} onSave={(v) => api.save(v)} properties={[
  { key: "title", label: "Title", group: "Content" },
  { key: "width", label: "Width", type: "number", unit: "px", group: "Layout", validate: (v) => v > 420 ? "At most 420" : null },
  { key: "elevated", label: "Shadow", type: "switch", group: "Look" },
  { key: "radius", label: "Radius", type: "slider", min: 0, max: 24, group: "Look", hidden: (v) => !v.elevated },
]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `properties` | `PropertySpec[]` / accessor | — | `{ key, label, type, control, group, description, options, min, max, step, unit, placeholder, readonly, hidden, validate, keywords }` |
| `value` | object / signal / `bind:value` | — | the edited object (`setValue` / `onChange` also work) |
| `saved` | object / accessor | the value at start | what changes are compared with; after `onSave` the current value |
| `onSave` | `(values) => unknown` | — | shows Save; DirtyState's `saveAll()` runs it too |
| `history` | `UndoStack` / `false` | `undoStack()` | where changes are recorded |
| `dirty` | `DirtyState` / `false` | `dirtyState()` | where unsaved changes are registered (`id`, `label`) |
| `groups` | string[] | order of appearance | group order |
| `search` | boolean | `true` | the search field (label, key, group, keywords, description; Turkish-aware folding) |
| `layout` | `auto` `stacked` | `auto` | label beside the editor (stacked in narrow panels) or always above |
| `api` | `(api) => void` | — | `changes()`, `save()`, `revert()`, `markSaved()`, `focus(key)` |

Types: `text`, `textarea`, `number`, `int`, `slider`, `switch`, `select`, `segmented`, `color` (TextInput, Textarea,
NumberInput, Slider, Toggle, Select, Segmented, ColorInput). `control` takes any component: it gets `value` (a getter),
`setValue`, `id`, `labelledby`, `describedby`, `invalid`, `readonly` and the property's options.

## Accessibility

The grid is a named section. Each row's name is a `<label for>` of its editor (group controls get `aria-labelledby`);
descriptions and errors are linked with `aria-describedby`, errors are announced. Groups are native
`<details>` (keyboard and screen readers for free). Reset buttons have names ("Reset Width") and leave the tab order
while there is nothing to reset. Undo / Redo buttons name the step they will undo.

## Composed of

Disclosure (groups), TextInput (search and text), NumberInput, Slider, Toggle, Select, Segmented, ColorInput, Textarea.
Undo manager (history), DirtyState manager (unsaved changes), fold search (ui/fold).
