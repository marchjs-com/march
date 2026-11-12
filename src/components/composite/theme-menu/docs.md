# ThemeMenu

One top-bar menu for the whole look: light / dark / system, the color theme (each drawn by a live swatch of itself) and
the accent color. Its sections are the same ones `ThemePicker` and `AccentPicker` show on their own, so an app can use
one menu or the separate pickers and they always match. Choices are remembered.

```tsx
<ThemeMenu />
<ThemeMenu themes={false} accents={["primary", "brand-orange", "brand-blue"]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `label` | string (reactive) | `Appearance` | button label |
| `themes` | boolean | `true` | show the color themes |
| `accents` | `ColorToken[]` or `false` | `ACCENT_CHOICES` | accent choices; `false` hides the section |
| `placement` | `"bottom-end"` … | `"bottom-end"` | where the panel opens |
| `class` | class | — | on the button |

## Accessibility

The button opens a Dropdown panel (Escape closes, focus returns to the button). Light / dark / system is a labelled group
of toggle buttons (`aria-pressed`); themes and accents are labelled `radiogroup`s of `role="radio"` buttons with
`aria-checked`. Swatches are decorative (`aria-hidden`); names are text, translated by the locale pack.

## Composed of

Dropdown (button and panel), ThemeSwatch (live theme previews), OverflowText (long theme descriptions).
