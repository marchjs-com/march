# Compass

A heading on a compass rose: a ship's or an aircraft's compass, a map's orientation, a drone's heading, a wind
direction. Two ways to read it: the rose turns under a fixed lubber line (`mode="rose"`, default), or a two-tone needle
turns on a fixed rose (`mode="needle"`, a hiking compass, a wind dial). Cardinal letters come in the page's language,
a bearing marker shows a course to steer, and the readout rolls ("045° NE"). The card moves on a damped spring, always
the short way round (350° → 10° turns 20° forward).

```tsx
<Compass heading={$heading} />
<Compass heading={$heading} bearing={120} points={8} />
<Compass heading={$wind} mode="needle" readout={false} />
<Compass heading={$h} cardinals={["K", "D", "G", "B"]} color="brand-blue" />
```

## Design: why it composes Gauge

A compass card is a 360° scale from north that wraps. Gauge already has that (`sweep={360}`, `start={0}`, `wrap`),
turns its scale under fixed needles (`turn`: the rose mode), draws the needle mode's two halves (`needles`, left out of
the spoken value with `silent`), and its `peak` mark at a number is the bearing marker on the card. The readout is
CountRoll. Compass adds what is its own: the heading kept continuous (Gauge's `unwrap`), the cardinal names, the
lubber line and the "045° NE" text.

## Props

| Prop | |
|---|---|
| `heading` | Degrees, 0 = north, clockwise; any number (it wraps). Required. |
| `mode` | `"rose"` (the rose turns, default) or `"needle"` (the needle turns). |
| `bearing` | A course to steer, marked on the rose; `null`: none. |
| `points` | `4` (N E S W, numbers 3, 6, 12… between) or `8` (with NE, SE, SW, NW). |
| `cardinals` | Your names of the points from north, clockwise (4 or 8). Default: translated N, E, S, W (NE…). |
| `readout` | `true` (rolling "045° NE"), `(heading) => node`, or `false`. |
| `color` | Theme color token of the north needle, the lubber line, the north letter and the bearing. Default `"danger"`. |
| `size` | Width in px. Default 220. |
| `parts` | `face`, `ticks`, `labels`, `lubber`, `bearing`, `readout`, `hub`, `glass` on or off. |
| `motion` | `false`: turns at once; reduced motion does the same. |
| `label` | Accessible name. Default "Compass". |

Class hooks: `m-compass` (+ `m-compass-rose`, `m-compass-needle`), `m-compass-lubber`, `m-compass-north`,
`m-compass-south`, `m-compass-readout`, and the Gauge hooks inside. `export const norm(deg)` keeps a heading in 0–360.

## Accessibility

- The dial is a `role="meter"` (0–360) whose value text is the heading in words ("045° NE"), at most 4 updates a
  second; the bearing is part of its name ("Compass, bearing 120° E").
- Motion runs on the motion engine; reduced motion (or `motion={false}`) turns the card at once.

## Composed of

Gauge, CountRoll.
