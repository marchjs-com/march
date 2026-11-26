# AnalogClock

A 12-hour clock dial with hour, minute and second hands, as on a wall clock or a fine watch: the time in another city,
a world-clock row, an office dashboard, a booking screen. The second hand ticks once a second with a small spring (a
quartz tick) or sweeps smoothly; the time is the system clock, a time zone's, or your own source.

```tsx
<AnalogClock />
<AnalogClock timeZone="Asia/Tokyo" caption="Tokyo" seconds="smooth" />
<AnalogClock numerals="roman" seconds={false} hands={{ hour: { color: "brand-blue" } }} />
<AnalogClock time={$meetingTime} readout={(d) => d.toLocaleDateString()} />
```

## Design: why it composes Gauge

A clock face is a dial: a 360° scale starting at 12 o'clock that wraps, ticks and numerals, a bezel, a hub, glass and
needles. Gauge draws all of that (`sweep={360}`, `start={0}`, `wrap`, `needles`), so the clock is a Gauge with three
needles. AnalogClock adds only what a dial cannot know: the time of day (system clock, an IANA time zone through Intl,
or your `time`), the hand values kept continuous (a hand passing 12, or a time set back, takes the short way round:
Gauge's `unwrap`), the beat (a timer on each whole second, frames while a smooth hand sweeps, only while on screen)
and the spoken time.

## Props

| Prop | |
|---|---|
| `time` | Your own time source: a Date, a timestamp (ms) or a live accessor. Default: the system clock. A plain function is read again on each beat. |
| `timeZone` | IANA time zone ("Europe/Istanbul"). Default: the device's. |
| `seconds` | `"tick"` (default: jumps once a second on a spring), `"smooth"` (sweeps every frame) or `false` (no second hand). |
| `numerals` | `"arabic"` (default), `"roman"`, `"quarters"` (12, 3, 6, 9), `"none"` or `(hour) => text`. |
| `hands` | Each hand's look (`length`, `width`, `tip`, `tail`, `color`, `class`) or `false`: `{ hour, minute, second }`. |
| `caption` | Text on the dial (a city, a brand). |
| `readout` | `(date) => node`: a small window under the hub (a date, a digital time). |
| `color` | Theme color token of the second hand. Default `"danger"`. |
| `size` | Width in px. Default 220. |
| `parts` | `face`, `ticks`, `numbers`, `hub`, `glass`, `caption` on or off. |
| `motion` | `false`: the hands jump (no spring, a smooth hand ticks); reduced motion does the same. |
| `label` | Accessible name before the time. Default "Clock". |
| `onTick` | Called once a second with the time shown. |

Class hooks: `m-clock` (+ `m-clock-tick`, `m-clock-smooth`, `m-clock-none`), `m-clock-hour`, `m-clock-minute`,
`m-clock-second`, `m-clock-readout`, and every Gauge hook inside (`m-gauge-label`, `m-gauge-tick`, `m-gauge-hub`…).

## Accessibility

- The clock is a `role="img"` named "Clock: 3:45 PM" (in the page's language and the time zone). The name changes
  once a minute, never every second; the inner Gauge is hidden from screen readers.
- Motion: the ticking spring and the smooth sweep run on the motion engine; reduced motion (or `motion={false}`) makes
  the hands jump. The time itself keeps true even while motion is paused, and the clock only ticks while on screen.

## Composed of

Gauge.
