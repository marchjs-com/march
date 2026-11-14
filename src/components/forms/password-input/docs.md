# PasswordInput

A password field with a Show / Hide button. `autocomplete` defaults to `current-password`; use `new-password` on
sign-up forms so password managers offer to generate one.

```tsx
<Field label="Password" help="At least 10 characters"><PasswordInput bind:value={$pw} autocomplete="new-password" /></Field>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `string` | `""` | |
| `autocomplete` | string | `"current-password"` | |
| `placeholder`, `maxLength`, `minLength` | | | |
| `readonly`, `disabled` | boolean | — | |
| `toggle` | boolean or `(shown) => node` | `true` | `false` removes the show / hide button; a function draws its content |
| `labels` | `{ show?, hide?, showPassword?, hidePassword? }` | "Show", "Hide", "Show password", "Hide password" | button text and its accessible name |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

An icon instead of the text: `<PasswordInput bind:value={$pw} toggle={(shown) => <Icon of={shown ? eyeOff : eye} />} />`;
your own words: `labels={{ show: "Göster", hide: "Gizle" }}`; no button: `toggle={false}`.

## Accessibility

The toggle is a real button with `aria-pressed` and a label that says what it does ("Show password" / "Hide
password"); spellcheck is off so the password never reaches a spelling service.

## Composed of

Button (the show / hide toggle) beside a native input, wrapped like the other affixed inputs.
