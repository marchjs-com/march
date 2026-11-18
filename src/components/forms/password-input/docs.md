# PasswordInput

A password field with a show / hide button (an eye). `autocomplete` defaults to `current-password`; use `new-password` on
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
| `toggle` | `"icon"`, `"text"`, `false` or `(shown) => node` | `"icon"` | the eye; `"text"` the words; a function draws its content; `false` removes it |
| `onToggle` | `(shown) => void` | | called when the password is shown or hidden again |
| `labels` | `{ show?, hide?, showPassword?, hidePassword? }` | "Show", "Hide", "Show password", "Hide password" | the text button's words; the button's accessible name and hint |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

Words instead of the eye: `<PasswordInput bind:value={$pw} toggle="text" />` (your own: `labels={{ show: "Göster", hide: "Gizle" }}`);
your own drawing: `toggle={(shown) => …}`; no button: `toggle={false}`.

## Accessibility

The toggle is a real button with `aria-pressed` and a label that says what it does ("Show password" / "Hide
password"); spellcheck is off so the password never reaches a spelling service.

## Composed of

Button (the show / hide toggle) beside a native input, wrapped like the other affixed inputs.
