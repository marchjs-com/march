# DotMatrix

An LED dot-matrix display: the destination board of a bus, a stock ticker, a scoreboard, a "now playing" sign. Text
and numbers are drawn in a 5×7 dot font (ASCII, the Turkish letters and °; add your own glyphs) as lit dots over the
faint unlit grid, in a dark housing that stays dark in every theme. A new value appears with a wipe (column by
column) or a dissolve (dot by dot) on the motion engine; a change that arrives mid-way starts from the board as it is.
Text wider than the window (`columns`) scrolls like a marquee, a whole column at a time, after a short hold; it pauses
while the pointer is over it and while `paused`, and only runs while the board is on screen.

```tsx
<DotMatrix value="ANKARA  14:05" />
<DotMatrix value={$score} columns={3} align="end" color="danger" size="lg" />
<DotMatrix value={$temp} format={{ maximumFractionDigits: 1, style: "unit", unit: "celsius" }} columns={7} align="end" />
<DotMatrix value="Kapılar kapanıyor, lütfen geri çekilin" columns={16} speed={24} />
<DotMatrix value="I ♥ MARCH" glyphs={{ "♥": [".#.#.", "#####", "#####", ".###.", "..#..", ".....", "....."] }} />
<DotMatrix value={$text} transition="dissolve" duration={600} dot="square" parts={{ glow: false }} />
```

## Props

| Prop | |
|---|---|
| `value` | The text or number (it may be live). |
| `format` | A number's format: a function or Intl.NumberFormat options. Default: the number in the page's language. |
| `columns` | Window width in characters; longer text scrolls. Default: as wide as the text. |
| `align` | Shorter text: `"start"` (default), `"center"`, `"end"` (logical: start is the right side in a right-to-left page). |
| `scroll` | `"auto"` (default: scroll text wider than the window) or `false` (cut it at the window's end). |
| `speed` / `hold` | Scroll speed in dot columns per second (18); how long a new text stands before it scrolls (1200 ms). |
| `paused` / `pauseOnHover` | Stop the scroll; pause while the pointer is over the board (default true). |
| `spacing` | Empty dot columns between characters. Default 1. |
| `glyphs` | Your own glyphs: `{ "♥": [7 rows of 5 characters, "#" lit] }` or 5 column numbers (bit 0 the top row). They win over the font. |
| `dot` | `"round"` (default) or `"square"`. |
| `size` | `"sm"`, `"md"` (default), `"lg"` or the dot pitch in px. |
| `color` | Theme color token of the lit dots. Default amber (`--m-warn`). |
| `transition` / `duration` / `easing` | How a new value appears: `"wipe"` (default), `"dissolve"` or `"none"`; its length (420 ms) and easing ("out"). |
| `motion` | `false` (or `"none"`): a new value at once and no scrolling (the start of the text stays). Reduced motion does the same. |
| `label` | Accessible name before the text. Default "Display". |
| `parts` | `{ off, glow, bezel }`: the unlit dots, the glow of the lit ones, the housing. Each on by default. |
| `class` | Extra class on the root. |

Class hooks: `m-dm` (root; `is-scrolling`, `is-changing`, `m-dm-sm|lg`, `m-dm-bare`), `m-dm-screen` (the SVG),
`m-dm-off` (unlit dots), `m-dm-lit` (lit dots, `is-glow`). CSS variables: `--m-dm-dot` (dot pitch), `--m-dm-on` (lit
colour), `--m-dm-unlit`, `--m-dm-housing`, `--m-dm-glow`.

The scroll runs to the left whatever the page's direction: the font's letters read left to right. `align` and the
wipe follow the page (they start on the right in a right-to-left page).

## Accessibility

- The board is an image (`role="img"`) named "<label>: <text>" (`Display: ANKARA 14:05`); screen readers hear the
  whole text once, never the moving dots. Give the board a `label` that says what it shows ("Next train").
- Scrolling pauses on hover and with `paused` (give users a pause control for long messages); it stops under reduced
  motion or `motion={false}`, where the start of the text stands still. Put a long message in readable text as well
  when it matters.
- The housing stays dark in light and dark themes; choose a `color` with enough contrast on it (amber, success,
  danger, info).
