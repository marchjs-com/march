# Textarea

Multi-line text that grows with what is typed (`autosize={false}` keeps the height fixed). Same value and field wiring
as TextInput.

```tsx
<Field label="About" help={() => `${$about.length}/280`}><Textarea bind:value={$about} rows={3} maxLength={280} /></Field>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `string` | `""` | |
| `rows` | number | `3` | starting height |
| `autosize` | boolean | `true` | grow with the content |
| `mono` | boolean | — | monospace text (code, JSON, logs) |
| `tabIndent` | boolean / number | — | the Tab key indents (`true`: two spaces, or the number of spaces) instead of leaving the field |
| `onKeyDown` | `(e) => void` | — | key handler (runs before the indent; `preventDefault()` skips it) |
| `placeholder`, `maxLength`, `minLength`, `spellcheck` | | | passed to the textarea |
| `readonly`, `disabled` | boolean | — | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

## Accessibility

A native `<textarea>` labelled by its Field; growing never moves focus or the caret. With `tabIndent` the Tab key
no longer leaves the field: Shift+Tab still moves back, and Escape followed by Tab moves on (say so near a code field).

```tsx
<Textarea bind:value={$json} mono tabIndent rows={8} spellcheck={false} aria-label="JSON" />
```

## Composed of

Nothing: a styled native textarea.
