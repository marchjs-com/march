# ThemeEditor

Make a whole theme and watch it live. Start from a built-in theme (HADİ, Classic Cream, Night Blue, Neon, Indigo,
Minimal, High Contrast) or from scratch with one accent color; edit every color token for light and dark with a full
ColorPicker (accent, surfaces, text, border, status, HADİ brand colors, the categorical palette), pick tones from an
automatic tone scale, and fix contrast with the WCAG audit. Type (font families picked with the FontPicker: the device's fonts and a web font catalog, each name in its own type; scale ratio, line heights, weights),
shape (radius scale, spacing, density, shadows, border width) and motion (durations, three easing curves) are tokens
too. The preview is a small app screen of real components scoped to the editor (`data-m-theme` + the draft's
variables) in light or dark, LTR or RTL, with or without motion; "Apply to the app" switches the whole app to it. Out
come the defineTheme module, the stylesheet (themeCss) and JSON; in go pasted JSON, CSS or a share link.

```tsx
<ThemeEditor />
<ThemeEditor bind:value={$draft} base="night" />
```

Import it from `march/components/composite/theme-editor` (a large component: it stays out of the `march/ui`
barrel). The Colors tab, the preview, saving and the other tabs (one chunk) load as chunks of their own.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `ThemeDraft` | share link, saved draft, then `base` | the draft is plain data (JSON-safe) |
| `base` | preset id or `"scratch"` | `"hadi"` | where a new draft starts; a preset becomes a copy with its own id (`my-night`) |
| `tabs` | `("colors" \| "type" \| "shape" \| "style" \| "motion" \| "export")[]` | all | sections shown |
| `preview` | boolean | `true` | live preview beside the controls |
| `storageKey` | string or `false` | `"theme-editor"` | Save writes the draft here (StorageManager, local area) |
| `share` | boolean | `true` | read `?theme=…` from the URL on start |
| `warnUnsaved` | boolean | `true` | DirtyState asks before the page is left with unsaved changes |
| `onSave` | `(d) => void` | | called with the saved draft |
| `readonly` | boolean | | look, do not change |
| `presets` | boolean | `true` | the "Start from" row of base themes |
| `nameField` | boolean | `true` | the theme name field and its id line |
| `historyButtons` | boolean | `true` | the undo / redo buttons (Ctrl/Cmd+Z stays) |
| `applyButton` | boolean | `true` | the "Apply to the app" button |
| `previewControls` | boolean | `true` | the light / dark, LTR / RTL and reduced-motion switches above the preview |
| `labels` | object | `t` texts | texts of the frame: `editor`, `name`, `undo`, `redo`, `unsaved`, `saved`, `save`, `apply`, `applied`, `startFrom`, `scratch`, `sections`, `tabs: { colors, type, shape, motion, export }`, `preview`, `previewMode`, `light`, `dark`, `previewDirection`, `reducedMotion` |
| `class` | class | — | on the root (`m-te`); parts: `m-te-bar`, `-title`, `-name`, `-actions`, `-undo`, `-redo`, `-save`, `-apply`, `-bases`, `-base`, `-body`, `-panel`, `-stage`, `-stage-bar`, `-scope` |

```tsx
<ThemeEditor tabs={["colors", "shape"]} presets={false} applyButton={false} previewControls={false} storageKey={false} />
<ThemeEditor labels={{ tabs: { colors: "Palette", type: "Fonts" }, apply: "Try it on the app", startFrom: "Based on" }} />
```

The texts inside the tabs and the preview are ordinary `t` texts: the locale pack translates them, and
`messages(locale(), { "Contrast": "Readability" })` (march/i18n) replaces any of them by its English source.

## Theme draft and tokens

A `ThemeDraft` holds `light` and `dark` colors (the `ThemeColors` roles, `cat`, `brand`), `type`, `shape`, `style` and `motion`.
The Style tab edits the look beyond colors and sizes (`ThemeStyle`): how panels sit on the page (soft, flat, raised,
outlined, glass), a glowing edge in the accent color, the kind of shadow (soft, hard, none), a gradient fill for
primary buttons, heading letter spacing and the stroke of line icons. Each becomes tokens components read
(`--m-panel-bg`, `--m-panel-border`, `--m-panel-shadow`, `--m-panel-filter`, `--m-primary-fill`, `--m-accent-glow`,
`--m-tracking-tight`, `--m-icon-stroke`, `--m-bg-image`).
`draftToTheme(d)` makes the `ThemeDef` — colors, fonts, radius and `tokens` (new in `defineTheme`: extra `--m-*`
tokens for both modes, such as `text-md`, `space-4`, `radius-3`, `shadow-2`, `border-w`, `dur`, `ease-out`,
`primary-500`). Tokens equal to the built-in values are left out, so a theme stays small. `--m-border-w` sets the
border of buttons, inputs and cards (default 1px).

| Helper | |
|---|---|
| `presetDraft(id)`, `presetCopy(id)`, `draftFromTheme(def)`, `draftFromColor(hex, name)` | new drafts |
| `deriveDark(light)` | a dark mode from the light colors |
| `toneScale(color)`, `typeScale(type)` | 50 … 900 tones; 2xs … 5xl sizes |
| `contrastAudit(colors)` | text pairs at 4.5:1, accents and indicators at 3:1, each failure with a `fix` |
| `draftTokens(d, all?)`, `draftToTheme(d)`, `draftVars(d, mode)` | tokens, ThemeDef, the variables of one mode |
| `draftCode(d)`, `draftCss(d)`, `draftJson(d)` | defineTheme module, stylesheet, JSON |
| `importTheme(text)`, `normalizeDraft(v)` | JSON, defineTheme JSON, CSS or a share link → draft |
| `shareUrl(d)`, `sharedDraft(href)`, `encodeDraft(d)`, `decodeDraft(code)` | share links (the theme is in the link) |
| `registerDraft(d)`, `applyDraft(d)` | offer it in ThemePicker / ThemeMenu (a runtime theme: `ThemeInfo.load`), switch the app to it |
| `PRESETS` | the built-in theme definitions |

## Accessibility

The editor is a named group; every control has a name (token buttons say the role and the color, sliders are labelled by
their row). Tabs move with the arrow keys; token buttons, presets and tones are toggle buttons (`aria-pressed`). Ctrl/Cmd+Z
and Ctrl/Cmd+Shift+Z undo and redo outside text fields. The contrast summary is a live region; import errors are alerts.
The preview is a named region; its direction switch shows the theme right to left, and reduced motion sets its
durations to 0. Layout uses logical properties throughout.

## Composed of

ColorPicker (each color), EasingCurveEditor (easing tokens), Tabs, Segmented, Slider, Select, TextInput, Textarea,
Toggle, Field (labelled rows), Button, UndoRedo (history buttons; keys through `undoKeys`), CopyButton, Badge,
PanelHeader (top bar), SectionLabel (small group labels), ListRow (color tokens, contrast checks), Swatch (color
samples, tone scale), Card (contrast audit, export steps), Stack, Alert, ThemeSwatch, CodeView; the managers undo
(`undoHistory`), DirtyState and StorageManager. The preview draws Button, Card, Tabs, Alert, Avatar, Progress, Field,
Checkbox, Toggle, Slider, Select, Chip and BarChart.
