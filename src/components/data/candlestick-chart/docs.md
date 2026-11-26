# CandlestickChart

Prices over time: each row is one period with its open, high, low and close. Rising candles take the theme's good
color, falling ones the bad color. Add `volume` for a volume pane, `ma` for moving averages, `marks` for price lines
and bands, `window` to follow the latest candles of live data, and `navigator` for an overview strip to pick a range.
Display only: no order entry.

```tsx
<CandlestickChart data={$btc} x="date" volume="vol" ma={[20, 50]} format={["money", "USD"]} title="BTC / USD" />
<CandlestickChart data={$ticks} window={60} type="ohlc" marks={[{ y: 64000, label: "Hedef", color: "brand-blue" }]} sync="market" />
<CandlestickChart data={history} type="line" navigator up="brand-green" down="brand-orange" />
```

## Props

| Prop | |
|---|---|
| `data` | Rows (array, signal or function), sorted by x. It may grow live. |
| `x` | The time of a row: a key or getter. Default "date". Dates → time axis, numbers → linear, else the row order. |
| `open` / `high` / `low` / `close` | Price fields: keys or getters. Defaults "open", "high", "low", "close". |
| `volume` | Volume field; given, a lower pane shows volume bars (the legend toggles it). |
| `type` | "candle" (default), "ohlc" (bars with open / close ticks) or "line" (the close). |
| `up` / `down` | Colors of rising / falling candles: theme tokens ("success", "brand-green"…) or CSS colors. |
| `ma` | Moving averages of the close, e.g. `[20, 50]`; each one a legend item. `colors` colors them. |
| `marks` | Reference marks: `{ y }` price line, `{ y: [a, b] }` band, `{ y: "average" }`, `{ x }` date line, `{ at: [x, y] }` note. |
| `lastPrice` | Dashed line and tag at the last close. Default true. |
| `window` | Only the latest rows: `n`, `{ last: n }` or `{ ms: span }`. Live data then slides. |
| `navigator` | `true` or a height in px: an overview strip with a window to drag (move it, pull an edge, or draw a new one). |
| `zoom` | Drag across the plot to zoom (default true); double click, Escape or "Reset zoom" resets. |
| `sync` | Charts with the same name share the crosshair. |
| `grid` | `true` (horizontal, default), `false` or "both". |
| `format` / `volumeFormat` / `xFormat` | Price (default "number"), volume (default "compact") and time formats: pipe name, `[pipe, ...args]` or a function. |
| `labels` | Tooltip and table texts: `{ open, high, low, close, volume, change }`. |
| `xLabel` | Header of the time column in the data table (default "Date"). |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed candle (`{ open, high, low, close, volume, change, up, datum }`). |
| `animate` | `true` (spring, default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `title` / `description` | Accessible name (SVG title, table caption) and longer description. |
| `legend` / `empty` / `colors` / `width` / `height` / `class` / `export` | Legend (MAs and volume), no-data content, MA colors, size (default height 320), extra class, export buttons. |

Class hooks: `m-candle`, `m-candle-up`, `m-candle-down`, `m-candle-body`, `m-candle-wick`, `m-candle-tick`,
`m-candle-volume`, `m-candle-ma`, `m-candle-close`, `m-candle-last`, `m-candle-tag`; colors `--m-candle-up`,
`--m-candle-down`.

## Accessibility

- The SVG has a title and description; a visually hidden data table lists every candle (date, open, high, low,
  close, volume).
- Tab reaches the chart; ← → move between candles, Home / End jump, Enter selects, Escape clears (and resets the zoom).
  The tooltip and the crosshair follow the keyboard candle; the focused candle is outlined.
- The navigator's edges are sliders (← →, Shift for big steps, Home / End). Legend items are toggle buttons.

## Motion

- Enter: every candle grows out of its open price (body and wick), volume bars rise from zero; `stagger` plays them
  one after another. The close line and the moving averages rise from their mean.
- Update: changed prices morph; the time and price domains glide, so on a live append the candles slide left while
  the new one grows in, and zooming eases into the range.
- Exit: a candle that leaves the window shrinks into its open price before it is removed.
- `animate={false}` or reduced motion: everything takes its place at once.
