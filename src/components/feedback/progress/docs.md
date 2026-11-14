# Progress

A progress bar with a label and the percentage, or an indeterminate one while the amount is unknown. Tones for meaning, three sizes, and several colours laid out as a gradient, equal segments or a flowing cycle (HADİ: the four brand colours by default).

```tsx
<Progress value={$p} label="Uploading" showValue />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | `number` / accessor / `null` | | `null` or absent: indeterminate |
| `max` | `number` | `100` | |
| `label` | `string` / accessor | | shown above, and the accessible name |
| `showValue` | `boolean` / `(percent, value) => node` | `false` | the rounded percentage, or your own text |
| `ariaLabel` | `string` / accessor | "Progress" (translated) | accessible name when there is no visible `label` |
| `tone` | `primary` `success` `warn` `danger` `info` | `primary` | one-colour fill |
| `size` | `sm` `md` `lg` | `md` | track height |
| `color` | colour token | | the single colour |
| `colors` | `"brand"` / colour tokens / `"single"` | the theme's | several colours, or one in a multicolour theme |
| `paint` | `gradient` `segments` `cycle` | `gradient` | how several colours are laid out |
| `class` | class value | | |

```tsx
<Progress value={$done} max={8} label="Upload" showValue={(percent, value) => `${value} of 8 files`} />
<Progress value={40} ariaLabel="Storage used" />
```

## Accessibility

`role="progressbar"` with `aria-valuemin`, `aria-valuemax` and `aria-valuenow` (absent while indeterminate) and the
label as its name ("Progress" when none). The fill is clipped, not scaled, and mirrors in right-to-left layouts; the
cycle and the indeterminate sweep stop with reduced motion.

## Composed of

Nothing: a track and a fill.
