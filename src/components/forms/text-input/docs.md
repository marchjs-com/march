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
| `m:color` | ColorToken | primary | Common prop (march/props): the colour token of the component and everything in it. |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

```tsx
<TextInput bind:value={$email} type="email" aria-label="Email" error={$problem} />                 // no Field: its own error text
<TextInput bind:value={$draft} onPaste={(e) => { const lines = e.clipboardData?.getData("text").split("\n") ?? []; if (lines.length > 1) { e.preventDefault(); addAll(lines); } }} />
```

## Masks (`mask`)

`mask` formats while typing with march/mask: a pattern, an array of literals and RegExps, a preset or a function of the
raw value. The caret stays where it belongs (typing, Backspace / Delete over literals, selection replace, paste with
junk), Android keyboards are read from `beforeinput`, IME composition is left alone until it ends, and the field keeps its
own undo / redo (Ctrl+Z, Ctrl+Y). The mask part loads with the first masked TextInput.

```tsx
import { cardNumber, money } from "march/mask/presets";
import { date } from "march/mask";
<TextInput bind:value={$phone} mask="(999) 999 99 99" />                                    // raw "5551234567"
<TextInput bind:value={$card} mask={cardNumber()} onMaskState={(s) => $type = s.name} />     // 4-6-5 for 34 / 37, Luhn
<TextInput bind:value={$birth} mask={date()} maskValue="parsed" maskPlaceholder="eager" />   // ISO "1990-04-23"
<TextInput bind:value={$amount} mask={money({ currency: "TRY" })} maskValue="parsed" />     // 1234.5
<TextInput mask="AA-9999" maskMotion={{ reject: false, fill: (el) => myPop(el) }} maskDone={false} />
```

| Prop | Type | Default | |
|---|---|---|---|
| `mask` | MaskSpec | — | pattern (`9` digit, `a` letter, `A` capital — Turkish İ / I —, `*` either, `[ ]` optional, `{n,m}` repeats, backslash for a literal), array, preset, function |
| `maskValue` | `"raw"` / `"masked"` / `"parsed"` | `"raw"` | what `value` holds: "5551234567", "(555) 123 45 67" or the mask's parsed value (number, ISO date) |
| `maskPlaceholder` | `"lazy"` / `"eager"` / `"ghost"` / `"none"` | `"lazy"` | literals appear while typing / the whole template `(___) ___` / the rest drawn faded after the text |
| `maskMotion` | boolean / `{ literal, fill, reject, complete }` | on | literals fade in, slots grow as they fill, a refused character shakes, the check mark pops; `false` all off, a part `false` or `(el) => …` |
| `maskDone` | boolean / icon / node | check | mark at the end of a complete, valid value |
| `maskHint` | string / `false` | the mask's | format hint for screen readers (`aria-describedby`), e.g. "GG.AA.YYYY" |
| `maskLabels` | `{ complete }` | "Complete" | the text announced when the value is complete |
| `onMaskState` | `(state) => void` | — | `{ text, raw, complete, error, value, name }` on every change |
| `onComplete` | `(state) => void` | — | each time the value becomes complete |

The mask's own error (an invalid card number, a date that does not exist) marks the input invalid and shows in its error
line when it has no `<Field>`; inside a `<Form>` the schema checks `mask` the same way (`{ type: "text", mask: iban() }`).
The motion runs on the motion engine (`play`): global speed and pause apply, reduced motion skips it. Masked values read
left to right (`dir="ltr"`) in every language; the input stays a real `<input>` with the mask's `inputmode` and
`autocomplete` unless you give your own. Screen readers hear the format hint, errors and completion, not each keystroke.

## Accessibility

A native `<input>`: its label comes from `<Field>` (`<label for>`) or `aria-label`; errors are linked with
`aria-describedby` and `aria-invalid` (the `error` prop does the same for an input without a Field, and its text is a
`role="alert"`). Prefix and suffix are plain text next to the input, so they are read with it.

## Composed of

Nothing: a styled native input. Prefix / suffix wrapping is shared with the other text inputs (forms/affix.ts).
