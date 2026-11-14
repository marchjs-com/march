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
| `placeholder`, `maxLength`, `minLength`, `spellcheck` | | | passed to the textarea |
| `readonly`, `disabled` | boolean | — | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

## Accessibility

A native `<textarea>` labelled by its Field; growing never moves focus or the caret.

## Composed of

Nothing: a styled native textarea.
