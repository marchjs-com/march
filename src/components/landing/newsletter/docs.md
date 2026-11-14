# Newsletter

An email sign-up, inline (field and button on one line) or stacked. While sending, the button shows its spinner; on
success the form folds away and a check with the thank-you line pops in; on an error the field shakes and the message
is announced.

```tsx
<Newsletter title="Stay in the loop" lead="One email a month."
  onSubmit={(email) => api.subscribe(email)} note="Unsubscribe any time." />
<Newsletter onSubmit={save} button="Join" done="You are in." doneIcon={<Icon of={heart} />} motion={false}
  labels={{ email: "Your email", invalid: "That does not look like an email.", error: "Could not save. Try again." }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `onSubmit` | `(email) => unknown \| Promise` | — | throw / reject to show an error (its message) |
| `title`, `lead`, `note` | node | — | |
| `placeholder` | string | `you@example.com` | |
| `button` | node | `Subscribe` | |
| `done` | node | `Thanks! Check your inbox.` | success line |
| `layout` | `inline` `stacked` | `inline` | |
| `labels` | `{ email, invalid, error }` | translated | the field's accessible name, the invalid-address message, the fallback error message |
| `doneIcon` | boolean / node | `true` | the check mark of the success line, or your own |
| `motion` | boolean | `true` | the shake on an error and the fold / pop on success |
| `class` | string | — | extra class on the root (`.hm-nl`; parts: `.hm-nl-title`, `.hm-nl-form`, `.hm-nl-field`, `.hm-nl-btn`, `.hm-nl-done`, `.hm-nl-msg`, `.hm-nl-note`) |

## Accessibility

The field has an accessible name ("Email address"), `autocomplete="email"` and is marked invalid on an error; the
error is a live alert linked with `aria-describedby`; the success line is a status message. The form is labelled by
its title.

## Composed of

TextInput, Button; motion engine (fold, pop, shake).
