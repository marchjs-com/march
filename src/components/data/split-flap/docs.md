# SplitFlap

A split-flap board: the clattering departure board of a station or an airport, a scoreboard, a counter of letters.
Each cell is a reel of flaps (a blank, the Turkish alphabet, Q W X, digits and signs); when the value changes every cell
turns forward, one flap at a time, until it shows its character, the cells starting one after another. The leaf
folds over the hinge on the motion engine's clock, so global speed, pause, reduced motion and off-screen pausing all
apply. A new value mid-way keeps each reel turning from the flap it shows (reels only go forward, as real ones do).

```tsx
<SplitFlap value="İSTANBUL" length={10} />
<SplitFlap value={$gate} length={3} align="end" color="warning" size="lg" />
<SplitFlap value={$status} length={12} flapTime={50} stagger={30} live="polite" label="Durum" />
<SplitFlap value={$code} chars=" 0123456789" length={4} onSettle={(t) => console.log("shown", t)} />
```

A timetable is a column of boards, one per field:

```tsx
<For each={$flights}>{(f) => <div class="row">
  <SplitFlap value={f().time} length={5} /> <SplitFlap value={f().city} length={12} /> <SplitFlap value={f().gate} length={3} />
</div>}</For>
```

Numbers only (a counter, a clock)? Use Odometer `variant="flip"` or FlipClock: they roll digits. SplitFlap is for
letters.

## Props

| Prop | |
|---|---|
| `value` | The text (it may be live). |
| `length` | Number of cells: longer text is cut, shorter padded with the blank flap. Default: as many as the text. |
| `align` | Shorter text: `"start"` (default), `"center"` or `"end"`. |
| `chars` | The reel, in turning order, the blank first. Default `FLAP_REEL` (capitals): text is upper-cased in the page's language (i → İ in Turkish). A reel with lower case keeps the case. A character not on the reel is shown as it is, without flaps. |
| `flapTime` / `stagger` | One flap's time (70 ms) and the delay between neighbouring cells as they start (45 ms). |
| `size` | `"sm"`, `"md"` (default), `"lg"` or the cell height in px. |
| `color` | Theme color token of the characters. Default: the board's white ink. |
| `frame` | The board around the cells. Default true. |
| `motion` | `false` (or `"none"`): a new text at once. Reduced motion does the same. |
| `label` | Accessible name before the text. Default "Board". |
| `live` | `"polite"`: announce the text once the board has settled. Default `"off"`. |
| `onSettle` | Called with the text when every cell has stopped. |
| `class` | Extra class on the root. |

Class hooks: `m-flap` (root; `is-moving`, `m-flap-sm|lg`, `m-flap-bare`), `m-flap-cells`, `m-flap-cell` (`is-idle`),
`m-flap-half` (`is-top`, `is-bottom`), `m-flap-leaf`, `m-flap-face` (`is-front`, `is-back`), `m-flap-glyph`. CSS
variables: `--m-flap-h` (cell height), `--m-flap-w`, `--m-flap-gap`, `--m-flap-radius`, `--m-flap-card`,
`--m-flap-card-2`, `--m-flap-ink`, `--m-flap-seam`; `--m-flap-turn` is the leaf's angle, written per frame.

## Accessibility

- The cells are hidden from screen readers; a visually hidden text says "<label>: <text>" (`Board: İSTANBUL`) once,
  never the flaps on the way. With `live="polite"` the text is announced when the board has settled.
- Reduced motion (or `motion={false}`): the new text appears at once.
- The cards stay dark in light and dark themes, with light ink; a `color` should keep contrast on them.
