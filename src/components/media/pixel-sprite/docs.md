# PixelSprite

A pixel drawing on an LED screen, still or animated frame by frame: a built-in emoji or icon by name, or your own
`.led.json` sprite. The frames advance on the motion engine's clock: global speed and pause act on them, reduced motion
or `motion={false}` shows one frame, off screen nothing runs.

```tsx
<PixelSprite sprite="fire" pitch={12} />
<PixelSprite sprite="rocket" color="amber" />   {/* one color: the features stay readable (they are holes) */}
<PixelSprite sprite={{ fps: 6, palette: { g: "#3ddc84" }, frames: [["g.g", ".g."], [".g.", "g.g"]] }} />
```

Built-in (8 × 8): heart, heartbeat, smile, wink, sad, laugh, star, sun, moon, cloud, rain, bolt, fire, drop, note, bell,
check, cross, arrow-left / right / up / down, coffee, rocket, flower, thumbs-up, cat, home, gift, sparkle
(`LED_SPRITE_NAMES`). Add your own with `defineSprite("name", sprite)`; it then works as `:name:` in any LED text.

## The `.led.json` format

```json
{ "w": 8, "h": 8, "fps": 4, "loop": true, "palette": { "r": "#ff3355" }, "frames": [["..rr..", ".rrrr."], [".r..r.", "..rr.."]] }
```

One string per row, "." (or a space) is off; characters in `palette` get their color, others the screen's.
`parseLedJson(text)` reads one (invalid: null). A pixel-art editor for `.led.json` files will register with MarchIDE's
editor plugins once those exist.

## Props

| Prop | |
|---|---|
| `sprite` | A built-in name or your own sprite. |
| `fps` | Frames per second; default the sprite's (4). |
| `playing` / `frameIndex` | Play the frames (default true); the frame shown while not playing. |
| `cols` / `rows` | A bigger screen centers the sprite. |
| `shape`, `gap`, `roundness`, `bloom`, `ghost`, `scanlines`, `color`, `panel`, `pitch` | The LED look (see LedMatrix). |
| `label` | Accessible name; default the sprite's name. |
| `motion` | false or "none": one frame. |
| `class` | Extra class on the root. |

## Accessibility

An image named by the sprite (`sprite="thumbs-up"` is read as "thumbs up"); give `label` when the drawing means
something more ("Order ready"). Reduced motion shows the first frame only.
