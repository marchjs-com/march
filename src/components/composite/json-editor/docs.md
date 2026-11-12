# JsonEditor

JSON in two views. **Text**: the source with live parse errors (line and column), Format and Tab indentation.
**Tree**: a TreeEditor with type badges, inline editing and undo, loaded the first time the view is opened (a form that
only needs the text view stays small). A `schema` (JSON Schema subset) and `validate` check both views: the text view
lists the first problem with its path, the tree marks every invalid row.

```tsx
<JsonEditor bind:value={$settings} mode="tree" schema={schema} />
<JsonEditor bind:value={$raw} modes={["text"]} validate={(v) => (v.version ? null : "version is required")} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | any JSON | `null` | the parsed value; while the text is invalid, the raw string |
| `mode` | `text` `tree` | `text` | first view |
| `modes` | `JsonMode[]` | both | views offered; one hides the switcher |
| `schema` | `JsonSchema` | — | see TreeEditor |
| `validate` | `(value) => string \| null` | — | extra check |
| `expand` | number | `2` | tree levels open at start |
| `indent` | number | `2` | Format indent |
| `tabIndent` | boolean | `true` | Tab inserts two spaces in the text view |
| `rows`, `readonly`, `disabled` | | | |

`parseJson(text)` returns `{ value }` or `{ error, line, column }`.

## Accessibility

The views are a `tablist` (← → mirrored in RTL); the tree tab is `aria-disabled` while the text does not parse. The
text view's message is a `status` region and is the textarea's description while there is a problem
(`aria-invalid`). The tree view is described in TreeEditor.

## Composed of

TreeEditor (tree view, lazy); `validateJson` from its json-path helpers.
