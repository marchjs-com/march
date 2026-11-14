# ThemeMenu

One top-bar menu for the whole look: light / dark / system, the color theme (each drawn by a live swatch of itself) and
the accent color. Its sections are the same ones `ThemePicker` and `AccentPicker` show on their own, so an app can use
one menu or the separate pickers and they always match. Choices are remembered.

```tsx
<ThemeMenu />
<ThemeMenu themes={false} accents={["primary", "brand-orange", "brand-blue"]} />
<ThemeMenu icon={sun} modes={false} headings={false} />                       // own icon, no light / dark row, no headings
<ThemeMenu icon={false} label="Look" labels={{ theme: "Palette", accent: "Highlight" }} panelClass="my-panel" />
<ThemeMenu view="cards" current modes={false} />     // preview cards of every theme; the button shows the theme in use
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `label` | string (reactive) | `Appearance` | button label |
| `themes` | boolean | `true` | show the color themes |
| `accents` | `ColorToken[]` or `false` | `ACCENT_CHOICES` | accent choices; `false` hides the section |
| `placement` | `"bottom-end"` … | `"bottom-end"` | where the panel opens |
| `icon` | icon / `false` | palette | the button's icon; `false` = text only |
| `modes` | boolean | `true` | the light / dark / system row |
| `view` | `"list"` `"cards"` | `"list"` | how the themes are drawn: rows with a swatch, or a grid of preview cards (each a small page drawn by the theme: ground, surfaces, accent, text colour, corner) |
| `current` | boolean | `false` | the button shows the theme in use (its swatch and name) instead of the icon |
| `headings` | boolean | `true` | the section headings |
| `labels` | `{ theme, accent }` | `Theme`, `Accent` | heading texts (strings or accessors) |
| `class` | class | — | on the button |
| `panelClass` | string | — | on the opened panel (`m-theme-menu`) |

## Accessibility

The button opens a Dropdown panel (Escape closes, focus returns to the button). Light / dark / system is a labelled group
of toggle buttons (`aria-pressed`); themes and accents are labelled `radiogroup`s of `role="radio"` buttons with
`aria-checked`. Swatches are decorative (`aria-hidden`); names are text, translated by the locale pack.

## Composed of

Dropdown (button and panel), SectionLabel (section headings), ThemeSwatch (live theme previews; ThemePreview for the cards), OverflowText (long theme descriptions).
