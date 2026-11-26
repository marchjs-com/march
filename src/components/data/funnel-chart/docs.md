# FunnelChart

The stages of a flow (visits → sign-ups → payments) and how many make it to the next one. Each stage is as wide as
its value; inside it stand the value and its share of the first stage, between stages the step conversion and the
drop-off. Three shapes: `"funnel"` (smooth trapezoids whose curved sides run into the next stage), `"bars"` (centered
bars, with a faint ghost of the previous stage to show what was lost) and `"pyramid"` (a triangle, the first stage at its
base). Vertical or horizontal; per-stage palette colors or one hue fading stage by stage.

```tsx
<FunnelChart data={$steps} x="stage" y="people" title="Checkout" />
<FunnelChart data={signups} shape="bars" color="brand-blue" orientation="horizontal" conversionFormat={["percent", 0]} />
<FunnelChart data={levels} shape="pyramid" showShare={false} label={(p) => `${p.label}: ${p.value}`} legend />
```

## Props

| Prop | |
|---|---|
| `data` | Rows in flow order, one per stage: an array, a signal or a function returning one. |
| `x` | The stage name: a key or getter. Default "label". |
| `y` | The stage value: a key or getter. Default "value". Negative values count as 0. |
| `shape` | `"funnel"` (default), `"bars"` or `"pyramid"`. |
| `orientation` | `"vertical"` (default, top to bottom) or `"horizontal"` (left to right). |
| `gap` | Space between stages in px. Default 6. |
| `names` | Stage names beside the shape. Default true. |
| `showValue` / `showShare` | The value / the share of the first stage inside each stage. Default true. |
| `showConversion` | The step conversion (this stage / previous) between stages. Default true. |
| `dropoff` | The lost count between stages, and on bars a ghost of the previous stage. Default true. |
| `label` | `(point) => string` replaces the text inside a stage. |
| `format` / `shareFormat` / `conversionFormat` | Formats: a pipe name, `[pipe, ...args]` or a function. Defaults "number", percent, percent with one decimal. |
| `color` | One hue for every stage, fading stage by stage: a theme token or CSS color. |
| `animate` | `true` (default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `legend` | `true`, "bottom" or "right" shows a legend whose items hide / show stages. Default off. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed stage (`{ label, value, share, conversion, dropoff, datum }`). |
| `title` / `description` | Accessible name (SVG title, table caption) and longer description. |
| `xLabel` / `yLabel` / `empty` / `colors` / `width` / `height` / `class` / `export` | Table headers, no-data content, per-stage colors, size, export buttons. |

Class hooks: `m-funnel-stage`, `m-funnel-shape`, `m-funnel-ghost`, `m-funnel-value`, `m-funnel-name`, `m-funnel-between`.

## Motion

- Enter: the stages pour in one after another (each grows from its upper edge, 90 ms apart).
- Update: widths, lengths and the shape morph to the new values (a spring); switching `shape` morphs too.
- Exit: a leaving stage collapses to its middle line, then it is removed.
- `animate={false}` draws in place; `{ stagger: 0 }`, `"out"`, `{ enter: false }`… tune it. Reduced motion jumps.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists stage, value, share and conversion.
- Tab reaches the chart; ↑ ↓ (or ← →) move between stages, Enter / Space selects, Escape clears; the tooltip follows
  the keyboard stage, which gets a focus outline.
- Legend items are toggle buttons with `aria-pressed`.
