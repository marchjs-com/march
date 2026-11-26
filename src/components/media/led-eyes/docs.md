# LedEyes

A pair of LED eyes that feel alive. They blink, look left, right, up and down, go wide with surprise, droop when sleepy,
smile, frown, fall in love; on their own they blink every few seconds and glance around, and they can follow the
pointer. On a screen of 10 rows or more a mouth fits under them (smile, grin, flat, sad, open, o, talk).

```tsx
<LedEyes />                                      {/* alive: blinks and glances */}
<LedEyes expression="look-left" color="blue" />
<LedEyes mouth="talk" follow shape="tube" />
<LedEyes expression={$mood} alive={false} cols={24} rows={10} />
```

## Props

| Prop | |
|---|---|
| `expression` | "open" (default), "blink" (once each time it is set), "closed", "look-left", "look-right", "look-up", "look-down", "surprised", "sleepy", "happy", "angry", "sad", "love". |
| `look` | `{ x, y }` from −1 to 1: where the pupils look (overrides the expression's gaze). |
| `mouth` | "none" (default), "smile", "grin", "flat", "sad", "open", "o", "talk" (opens and closes). |
| `alive` | Blink now and then and glance around (default true). |
| `follow` | Follow the pointer anywhere on the page. |
| `blinkEvery` | `[min, max]` ms between alive blinks. Default [2200, 5600]. |
| `cols` / `rows` | Default 32 × 12 (16 rows with a mouth). |
| `shape`, `gap`, `roundness`, `bloom`, `ghost`, `scanlines`, `color`, `panel`, `pitch` | The LED look (see LedMatrix). |
| `label` | Accessible name; default describes the expression ("Eyes looking left"). |
| `motion` | false or "none": each expression at once, no blinks or glances. |
| `class` | Extra class on the root. |

## Motion

The gaze is a spring and the lids are tweens on the motion engine: a new expression glides from wherever the eyes are,
global speed and pause act on it, reduced motion shows each expression at once, off screen nothing runs.
`drawFace(frame, state, mouth)` and `faceMotion(host, …)` are exported for your own LED drawings (LedBoard uses them).

## Accessibility

An image named by its expression in words ("Surprised eyes"); the alive blinks are not announced.
