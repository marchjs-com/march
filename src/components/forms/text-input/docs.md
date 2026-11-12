# TextInput

Single-line text. Works standalone (`bind:value`, `value` + `onChange`, or uncontrolled) and inside a `<Field>` or
`<Form>`, which wire its id, `aria-invalid` and `aria-describedby`. **EmailInput** and **UrlInput** are the same control
with the right keyboard, autocomplete and trimming.

```tsx
<Field label="Search"><TextInput bind:value={$q} placeholder="Members, orders…" prefix={<Icon of={search} />} /></Field>
<Field label="E-mail"><EmailInput bind:value={$mail} /></Field>
<Field label="Website"><UrlInput bind:value={$site} /></Field>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `string` | `""` | |
| `type` | input type | `"text"` | `"search"`, `"tel"` … |
| `placeholder`, `autocomplete`, `inputmode`, `maxLength`, `minLength`, `spellcheck` | | | passed to the input |
| `prefix`, `suffix` | node | — | text or an icon around the input |
| `transform` | `(v) => string` | — | rewrites typed text (e.g. upper-case) |
| `readonly`, `disabled`, `autofocus` | boolean | — | |
| `color` | ColorToken | primary | focus ring, caret and selection |

## Accessibility

A native `<input>`: its label comes from `<Field>` (`<label for>`) or `aria-label`; errors are linked with
`aria-describedby` and `aria-invalid`. Prefix and suffix are plain text next to the input, so they are read with it.

## Composed of

Nothing: a styled native input. Prefix / suffix wrapping is shared with the other text inputs (forms/affix.ts).
