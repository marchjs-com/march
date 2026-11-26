# ChordChart

Who gives what to whom, drawn round: each group is an arc on the rim as long as its total, and ribbons through the
middle join the groups that exchange something, as wide at each end as what goes that way. Give a square `matrix`
(with `names`) or flow rows (`{ source, target, value }`). `directed` keeps every direction apart and ends the ribbons
in an arrow at the target.

```tsx
<ChordChart matrix={$migration} names={["İzmir", "Ankara", "İstanbul"]} title="Moves between cities" />
<ChordChart data={transfers} directed format={["money", "EUR"]} ribbonColor="target" ticks />
<ChordChart matrix={deps} names={modules} padAngle={0.08} thickness={8} labels={false} legend="right" />
```

## Props

| Prop | |
|---|---|
| `matrix` / `names` | A square matrix (`matrix[i][j]`: what i gives j) and the group names in its order (default "1", "2"…). |
| `data` / `source` / `target` / `value` | Instead of a matrix: flow rows and how to read them (keys or getters, defaults the same names). `names` then fixes the group order. |
| `directed` | Each direction its own ribbon with an arrow at the target; a group's arc holds what it gives and what it gets (default false). |
| `padAngle` / `thickness` | Gap between groups in radians (0.04) and arc width in px (14). |
| `ribbonColor` | "source" (default), "target" or "larger" (the end that gives more). |
| `labels` / `ticks` | Group names round the rim (default on) / value ticks: `true` (a nice step) or a step in value units. |
| `format` / `tableLabels` | Value format (pipe name, `[pipe, ...args]` or a function) and the data table headers `{ source, target, value }`. |
| `legend` | `true`, "bottom" or "right": one toggle per group (off by default: the rim carries the names). |
| `tooltip` | `true` (default), `false` or `(point) => content`. Point: `{ kind, key, label, value, back, source, target, datum }`. |
| `onSelect` | Called with the clicked / Enter-pressed group or ribbon. |
| `animate` | `true` (default spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `title` / `description` / `empty` / `colors` / `width` / `height` / `class` / `export` | Accessible name and description, no-data content, per-group colors, size, extra class, export buttons. |

Class hooks: `m-chord-group`, `m-chord-arc`, `m-chord-label`, `m-chord-ticks`, `m-chord-ribbon`, `m-chord-on` (lit by
hover), `m-chord-focus` (on the plot while a group is lit). `--m-chord-ribbon-opacity` sets the ribbon tint.

## Accessibility

- The SVG has a title and description; a visually hidden table lists every flow (source, target, value).
- Tab reaches the chart; arrows walk the groups round the rim and then the ribbons; Enter / Space selects, Escape
  clears. The tooltip and the highlight follow the keyboard; the focused mark wears a ring.

## Motion

- Enter: arcs and ribbons open from zero angle at 12 o'clock and fan out to their places (with `stagger`, one after
  another round the rim).
- Update: arcs and ribbon ends turn to their new angles when values change or a group is hidden.
- Exit: leaving arcs and ribbons collapse into their middles before they are removed.
- `animate={false}` or reduced motion: everything takes its place at once.
