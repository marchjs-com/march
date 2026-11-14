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
| `label` | string / accessor | `Properties` | accessible name, DirtyState and undo label |
| `historyButtons` | boolean | `true` | the Undo / Redo buttons (Ctrl+Z of the app's history still works) |
| `resetButtons` | boolean | `true` | the "reset to saved" button of each row |
| `changeMarks` | boolean | `true` | the dot on a changed row and the changed count of a group |
| `footer` | boolean | `true` | the change count with Revert and Save (`api.save()` / `api.revert()` stay) |
| `labels` | object | `t` texts | `search`, `general`, `empty`, `noMatch(query)`, `changed`, `changedCount(n)`, `unsaved(n)`, `noChanges`, `revert`, `save`, `undo`, `redo`, `reset(label)`, `resetTitle` |
| `class` | class | — | on the section (`m-pg`); parts: `m-pg-head`, `-search`, `-history`, `-group`, `-row`, `-name`, `-dot`, `-desc`, `-editor`, `-error`, `-reset`, `-empty`, `-foot`, `-changes`, `-revert`, `-save` |

```tsx
<PropertyGrid properties={specs} bind:value={$card} search={false} historyButtons={false} resetButtons={false} footer={false} />
<PropertyGrid properties={specs} bind:value={$card} onSave={save}
  labels={{ save: "Publish", revert: "Discard", unsaved: (n) => `${n} edits not published`, search: "Find a setting" }} />
```

Types: `text`, `textarea`, `number`, `int`, `slider`, `switch`, `select`, `segmented`, `color` (TextInput, Textarea,
NumberInput, Slider, Toggle, Select, Segmented, ColorInput). `control` takes any component: it gets `value` (a getter),
`setValue`, `id`, `labelledby`, `describedby`, `invalid`, `readonly` and the property's options.

## Accessibility

The grid is a named section. Each row's name is a `<label for>` of its editor (group controls get `aria-labelledby`);
descriptions and errors are linked with `aria-describedby`, errors are announced. Groups are native
`<details>` (keyboard and screen readers for free). Reset buttons have names ("Reset Width") and leave the tab order
while there is nothing to reset. Undo / Redo buttons name the step they will undo.

## Composed of

Disclosure (groups), SectionLabel (group names), SearchBox (search), PanelHeader (the head and the footer bar),
UndoRedo (history buttons), IconButton (row reset), Button (Revert, Save), Badge (changed count of a group), StatusDot
(the changed mark of a row), Empty (no match); editors: TextInput, NumberInput, Slider, Toggle, Select, Segmented,
ColorInput, Textarea.
Undo manager (history), DirtyState manager (unsaved changes), fold search (ui/fold).
