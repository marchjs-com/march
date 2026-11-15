# Toggle

An on / off switch for settings that apply at once. The thumb slides toward the inline end (mirrored in right-to-left
pages); the track takes the color token when on.

```tsx
<Toggle bind:value={$notify} label="Instant notifications" />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | boolean (`null` with `tristate`) | `false` (`null` with `tristate`) | |
| `tristate` | boolean | `false` | three states: on, off, not set (`null`, the thumb in the middle); a click goes not set → on → off → not set. For a prop where unset differs from `false` |
| `label` or children | node | — | |
| `m:color` | ColorToken | primary | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `disabled`, `readonly` | boolean | — | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

## Accessibility

A `<button role="switch">` with `aria-checked`: Space and Enter toggle it, screen readers announce "on" / "off"; the
label wraps it, so clicking the text toggles too. With `tristate` it is a `role="checkbox"` (a switch has no third
state): `aria-checked="mixed"` while not set.

## Composed of

Nothing: a button and its thumb.
