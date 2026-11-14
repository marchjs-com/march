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
| `size` | `sm` `md` `lg` / pixels | `md` | track thickness |
| `variant` | `bar` `line` | `bar` | `line`: a thin line whose fill is scaled (reading bar, deck progress, rail) |
| `orientation` | `horizontal` `vertical` | `horizontal` | vertical stands and fills from the top |
| `fillRef` | `(fill) => void` | | the fill element, for a driver that writes its transform (scroll, animation); never indeterminate then |
| `smooth` | `boolean` | `true` | `false`: follow the value at once (driven every frame) |
| `track` | `boolean` | `true` | `false`: only the fill |
| `inverse` | `boolean` | `false` | over media: white fill, translucent track |
| `decorative` | `boolean` | `false` | hidden from assistive technology |
| `segments` | `number` / accessor | | equal parts; `value` counts the full parts (`max` defaults to the count) |
| `duration` | ms / accessor | | segments: the part at `value` fills over this time, then `onDone` |
| `paused` | `boolean` / accessor | | holds the timed fill |
| `run` | any / accessor | | restarts the timed fill when it changes |
| `onDone` | `() => void` | | the timed fill is complete |
| `valueText` | `(value, max) => string` | | read instead of the number (`aria-valuetext`) |
| `color` | colour token | | the single colour |
| `colors` | `"brand"` / colour tokens / `"single"` | the theme's | several colours, or one in a multicolour theme |
| `paint` | `gradient` `segments` `cycle` | `gradient` | how several colours are laid out |
| `class` | class value | | |

```tsx
<Progress value={$done} max={8} label="Upload" showValue={(percent, value) => `${value} of 8 files`} />
<Progress value={40} ariaLabel="Storage used" />
<Progress variant="line" value={$read} smooth={false} ariaLabel="Reading progress" />
<Progress variant="line" decorative fillRef={(fill) => scrollIndicator(fill, { track: article })} />
<Progress segments={5} value={$step} valueText={(v, n) => `Step ${v} of ${n}`} />
<Progress variant="line" inverse segments={stories.length} value={$i} duration={6000} paused={$hold} run={story.id} onDone={next} />
```

A line is driven from outside in two ways: a `value` (a signal that follows the scroll, the slide, the step) or
`fillRef`, which hands the fill element to a driver that writes its transform itself. `--hm-progress-gap` is the space
between parts and `--hm-progress-track` the track colour.

## Accessibility

`role="progressbar"` with `aria-valuemin`, `aria-valuemax` and `aria-valuenow` (absent while indeterminate) and the
label as its name ("Progress" when none). The fill is clipped, not scaled, and mirrors in right-to-left layouts; the
cycle and the indeterminate sweep stop with reduced motion. A timed part keeps its time with reduced motion (it is
information); `decorative` hides the bar when another element already says the progress.

## Composed of

Nothing: a track and a fill.
