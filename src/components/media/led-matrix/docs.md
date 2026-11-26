# LedMatrix

A dot-matrix screen of LEDs on a canvas. Give it a picture, an `LedFrame` or pixel art as text ("." is off), and it
paints it; on every change it repaints only the LEDs that changed, and off screen it paints nothing until it comes back.
Every LED part (PixelFont, PixelSprite, LedEyes, LedBoard) draws on it, so they all share one look.

```tsx
import { LedMatrix, ledFrame, setLed } from "march/ui";

<LedMatrix frame={[".#.#.", "#####", ".###.", "..#.."]} color="red" pitch={16} />
<LedMatrix frame={["rr.gg", "rr.gg"]} palette={{ r: "#ff3355", g: "#3ddc84" }} />

const f = ledFrame(16, 8);              // your own drawing: one byte of brightness per LED
setLed(f, 3, 4);                         // full brightness, the screen's color
setLed(f, 4, 4, 128, 0xff8800 + 1);      // half brightness, orange
<LedMatrix frame={() => ($tick, f)} shape="square" scanlines />
```

## Props

| Prop | |
|---|---|
| `frame` | An `LedFrame` or art rows; a function is followed live. |
| `palette` | Colors of the art's characters (`{ r: "#f33" }`). |
| `cols` / `rows` | Screen size in LEDs; default the picture's (32 × 8 without one). A bigger screen centers the picture. |
| `shape` | "round" (default) LEDs, "square" pixels or "tube" glowing capsules. |
| `gap` / `roundness` | Space between LEDs (0–0.8 of the pitch, default 0.18) and square corner roundness (0–1, default 0.3). |
| `bloom` | Halo around lit LEDs in px (default 6); `false` or 0: none. |
| `ghost` | How much unlit LEDs show, 0–0.4 (default 0.1). |
| `scanlines` | Thin dark lines across the screen. |
| `color` | "rgb" (default: each LED its own color, the rest the accent), "theme", "amber", "green", "red", "blue", "white" or a theme token. |
| `panel` | "dark" (default, black in both themes), "theme" (the page surface) or "none". |
| `pitch` | Size of one LED in px; default: the screen fills its width. |
| `label` | Accessible name. Default "LED display". |
| `class` | Extra class on the root. |

## Frames

`ledFrame(cols, rows)`, `setLed(f, x, y, lit?, rgb?)`, `blit(dst, src, x, y)` (lit LEDs only, clipped at the edges),
`ledArt(rows, palette?)`, `ledColor("#f80")` (a stored color: 0xRRGGBB + 1, 0 = the screen's color).

Class hooks: `m-led` (root, `m-led-round|square|tube`, `m-led-panel-dark|theme|none`, `is-scanlined`), `m-led-screen`,
`m-led-canvas`, `m-led-halo`. Theme variables: `--m-led-on` (the LED color), `--m-led-bloom`, `--m-led-pad`.

## Accessibility

- An image (`role="img"`) named by `label`: say what the picture shows.
- The bloom halo and scanlines are decoration; the screen never moves unless its picture changes.
