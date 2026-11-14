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
| `format` | boolean | `true` | the Format button under the text |
| `status` | boolean | `true` | the "Valid JSON" confirmation (problems are shown either way) |
| `labels` | `{ text, tree, view, treeName, fixFirst, valid, format, invalid(line, column, message), more(count) }` | — | own texts (each falls back to the built-in one) |
| `rows`, `readonly`, `disabled` | | | |
| `class` | class value | — | on the root (`m-json-editor`) |

```tsx
<JsonEditor bind:value={$config} format={false} status={false}
  labels={{ text: "Source", tree: "Outline", invalid: (line, column) => `Check line ${line}, column ${column}` }} />
```

`parseJson(text)` returns `{ value }` or `{ error, line, column }`.

## Accessibility

The views are a `tablist` (← → mirrored in RTL); the tree tab is `aria-disabled` while the text does not parse. The
text view's message is a `status` region and is the textarea's description while there is a problem
(`aria-invalid`). The tree view is described in TreeEditor.

## Composed of

Textarea (text view: `mono`, `tabIndent`), Tabs (the view switcher: `TabList`, `variant="pill"`), Button (Format), TreeEditor
(tree view, lazy); `validateJson` from its json-path helpers.
