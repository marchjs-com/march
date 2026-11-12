# TreeEditor

Edit any JSON value as a tree. Each row shows its key, a **type badge** in a HADİ color (objects and lists Heyecan,
numbers Aktivite, text Dostluk, true / false İletişim) that converts the value to another type, and the value: a text
or number you edit in place, a switch for true / false, a count for objects and lists. Rows add, duplicate and delete;
a search box keeps the matches and their parents; a JSON Schema subset marks invalid rows with their message. Every
change is one step of the editor's own undo history.

```tsx
<TreeEditor bind:value={$config} schema={schema} />
<TreeEditor value={data} readonly search={false} expand={1} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | any JSON | `null` | a new value (immutable updates) on every change |
| `schema` | `JsonSchema` | — | `type` (incl. `integer`), `properties`, `required`, `additionalProperties`, `items`, `minItems` `maxItems`, `enum`, `minimum` `maximum`, `minLength` `maxLength`, `pattern`, `format` (email, uri, date, date-time), `description` (row hint) |
| `validate` | `(value) => JsonError[]` | — | extra problems with their paths |
| `onValidate` | `(errors) => void` | — | every validation result |
| `expand` | number | `2` | levels open at start |
| `search` | boolean | `true` | search box |
| `history` | boolean or UndoStack | own history | undo / redo buttons and Ctrl+Z; `false` turns it off |
| `label`, `readonly`, `disabled` | | | |

The helpers are exported too: `pointer`, `getAt`, `updateAt`, `removeAt`, `renameAt`, `insertAfter`, `convert`,
`validateJson`, `schemaAt`.

## Accessibility

`role="tree"` with one `treeitem` per row (`aria-level`, `aria-expanded`, `aria-selected`) and one tab stop. Keys:
↑ ↓ Home End move, → opens or enters, ← closes or goes to the parent (mirrored in RTL), Enter edits the value (toggles
true / false, opens containers), F2 renames, T opens the type menu (`menuitemradio`, ↑ ↓), + / Insert adds, Delete
removes, Ctrl+Z / Ctrl+Shift+Z undo and redo. Invalid rows have `aria-invalid` and their message as description; the
status ("Valid" / "N problems") is a live region.

## Composed of

Badge (type badges), IconButton (row actions, history), Toggle (true / false values); floating (type menu),
UndoManager (`undoHistory`).
