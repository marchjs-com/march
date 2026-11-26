# LedBoard

A fun LED sign. Text scrolls in any direction, with typewriter, blink, wave and rainbow effects and pixel emoji inline
(`:heart:`), and a list of scenes plays one after another: text, emoji, LED eyes with a mouth, pixel art, a clock, a
countdown, a score whose changed digits roll, a ticker, audio bars. Scenes change with a wipe, a dissolve, pixel rain or
an iris. It is composed of LedMatrix (the screen), PixelFont, PixelSprite and LedEyes.

```tsx
<LedBoard text="HADİ'ye hoş geldin :heart:" color="amber" />

<LedBoard transition="rain" scenes={[
  { text: "HADİ" },
  { eye: "look-left" }, { eye: "look-right", mouth: "smile" },
  { emoji: "heart" },
  { score: () => [$home, $away], teams: ["EV", "DEP"] },
  { clock: true },
  { countdown: "2027-01-01T00:00", done: "MUTLU YILLAR" },
  { ticker: ["BIST +1,2%", "USD 34,10"] },
  { bars: audioSource("demo") },
]} />
```

## Props

| Prop | |
|---|---|
| `text` | Text to show; the same as `scenes={[{ text }]}`. |
| `scenes` | Scenes played one after another (below). |
| `cols` / `rows` | Default 64 × 16. |
| `direction` / `speed` | "left" (default), "right", "up", "down"; LEDs per second (default 30). |
| `pause` | How long text that fits stays, in ms (default 1400; a standing scene lasts at least twice that). |
| `effect` | "none" (default), "typewriter", "blink", "wave", "rainbow". |
| `font` / `spacing` / `scale` / `ink` | "5x7" or "8x8"; LEDs between letters; 1–4 or "auto" (default: 2 on 16 rows); text color. |
| `transition` / `transitionDuration` | "wipe" (default), "cut", "dissolve", "rain", "iris"; ms (default 650). |
| `loop` | Start again after the last scene (default true). |
| `playing` / `pauseOnHover` | false holds the picture; hold while the pointer is over it. |
| `alive` / `follow` | Eye scenes blink and glance on their own (default true); follow the pointer. |
| `shape`, `gap`, `roundness`, `bloom`, `ghost`, `scanlines`, `color`, `panel`, `pitch` | The LED look (see LedMatrix). |
| `label` | Accessible name. Default "LED board". |
| `live` | Screen readers hear each scene's text: "polite" (default) or "off". |
| `motion` | false or "none": pages instead of scrolling, no effects or transitions. |
| `onScene` | `(index, scene)` when a scene starts. |
| `class` | Extra class on the root. |

## Scenes

Each scene sets one kind and any options: `text` (a function is read live), `emoji`, `eye` (+ `mouth`), `pixels`
(+ `palette`), `clock` (true, "HH:mm", "HH:mm:ss"), `countdown` (+ `done`), `score` (+ `teams`), `ticker`, `bars` (any
march/audio source); options `duration`, `direction`, `speed`, `effect`, `transition`, `ink`, `label` (what a screen
reader hears). Scrolling text lasts until it has passed; a scene that stands lasts `duration` (default 2.4–5 s).

## Motion

One clock: the board's time runs on the motion engine (global speed and pause act on it) and only while it is on
screen. Data changes animate: when a live text, a score or the clock changes, the columns that changed roll (the old
digits leave upward, the new ones come in from below). Reduced motion or `motion={false}`: text pages (each page fits
and stands), no blink, wave, roll or transitions; scenes still follow one another.

## Accessibility

- The board is a focusable region (`aria-roledescription="LED board"`). Space or Enter pauses and resumes (a pause mark
  shows), ← / → step to the previous / next scene (mirrored on right-to-left pages).
- A polite live region says each scene's text once when it starts (a clock is not read every second); `label` names
  the board, `live="off"` silences it.
- Moving content can be paused (WCAG 2.2.2): the keyboard, `playing`, `pauseOnHover`.
