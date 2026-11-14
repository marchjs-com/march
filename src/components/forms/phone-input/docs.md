# PhoneInput

A phone number stored as `+` and digits (`"+447700900123"`). With `country` the calling code is shown as a prefix and
put in front of national numbers; `normalizePhone(text, country)` is the same rule as a function.

```tsx
<Field label="Phone"><PhoneInput bind:value={$phone} country="+44" /></Field>
normalizePhone("0 (532) 111-22-33", "+90") // "+905321112233"
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `string` | `""` | "+" and digits |
| `country` | string | — | calling code, e.g. `"+90"` |
| `placeholder`, `autocomplete` | | `"tel"` | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

## Accessibility

`type="tel"` gives the phone keypad; the prefix is plain text read with the field.

## Composed of

Nothing: a native input with the shared affix wrapper.
