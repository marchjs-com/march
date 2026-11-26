# PhoneInput

A phone number typed in its country's format and stored as `+` and digits (`"+447700900123"`). It is a TextInput with
march/mask's `phone()` mask: the caret stays where it belongs, a pasted "+44 …", "0044 …" or "0…" is read, and the
country formats load on demand (one small chunk). With `country` (a calling code `"+44"` or an ISO code `"GB"`) the
calling code is the prefix and the number is national; without it the number is international and the country is
chosen by the calling code typed (`onMaskState` gets it as `name`). `normalizePhone(text, country)` is the plain rule as a
function.

```tsx
<Field label="Phone"><PhoneInput bind:value={$phone} country="TR" /></Field>            // "(532) 111 22 33" → "+905321112233"
<Field label="Phone"><PhoneInput bind:value={$intl} onMaskState={(s) => $cc = s.name} /></Field> // "+44 7700 900123"
normalizePhone("0 (532) 111-22-33", "+90") // "+905321112233"
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `string` | `""` | "+" and digits (E.164) |
| `country` | string | — | `"+90"` or `"TR"`; without it: international |
| `maskMotion`, `maskPlaceholder`, `maskDone`, `onMaskState` | | | as on TextInput (animations, lazy / eager / ghost template, check mark, state) |
| `placeholder`, `autocomplete` | | `"tel"` / `"tel-national"` | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

## Accessibility

`type="tel"` and `inputmode="tel"` give the phone keypad; the prefix is plain text read with the field; the format hint
is linked with `aria-describedby`; screen readers hear completion and errors, not every digit.

## Composed of

TextInput (its `mask` prop, march/mask `phone()`).
