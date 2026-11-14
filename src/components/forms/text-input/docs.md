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
| `onKeyDown`, `onPaste` | `(e) => void` | — | key and paste handlers of the input (`preventDefault()` on a paste keeps the text out) |
| `error` | string / accessor | — | error text of an input without a `<Field>`: the input turns invalid and the text shows under it |
| `errorSpace` | boolean | `false` | with `error`: the error line keeps its height while empty (nothing moves when an error appears) |
| `readonly`, `disabled`, `autofocus` | boolean | — | |
| `m:color` | ColorToken | primary | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

```tsx
<TextInput bind:value={$email} type="email" aria-label="Email" error={$problem} />                 // no Field: its own error text
<TextInput bind:value={$draft} onPaste={(e) => { const lines = e.clipboardData?.getData("text").split("\n") ?? []; if (lines.length > 1) { e.preventDefault(); addAll(lines); } }} />
```

## Accessibility

A native `<input>`: its label comes from `<Field>` (`<label for>`) or `aria-label`; errors are linked with
`aria-describedby` and `aria-invalid` (the `error` prop does the same for an input without a Field, and its text is a
`role="alert"`). Prefix and suffix are plain text next to the input, so they are read with it.

## Composed of

Nothing: a styled native input. Prefix / suffix wrapping is shared with the other text inputs (forms/affix.ts).
