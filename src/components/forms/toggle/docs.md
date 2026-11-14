# Toggle

An on / off switch for settings that apply at once. The thumb slides toward the inline end (mirrored in right-to-left
pages); the track takes the color token when on.

```tsx
<Toggle bind:value={$notify} label="Instant notifications" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | boolean | `false` | |
| `label` or children | node | — | |
| `color` | ColorToken | primary | track color when on |
| `disabled`, `readonly` | boolean | — | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

## Accessibility

A `<button role="switch">` with `aria-checked`: Space and Enter toggle it, screen readers announce "on" / "off"; the
label wraps it, so clicking the text toggles too.

## Composed of

Nothing: a button and its thumb.
