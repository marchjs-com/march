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

## Accessibility

The toggle is a real button with `aria-pressed` and a label that says what it does ("Show password" / "Hide
password"); spellcheck is off so the password never reaches a spelling service.

## Composed of

Nothing: a native input and a button, wrapped like the other affixed inputs.
