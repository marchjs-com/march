# FlipClock

A flip clock: the bedside clock whose number cards fall over every second. Hours, minutes and seconds are Odometer's
flip cards (only the cards whose digit changed move, on the motion engine), the separators blink once a second, and a
12-hour clock shows its morning / afternoon text on a small split-flap (SplitFlap) in the page's language. The time is
the system clock, a time zone's, or your own: a Date, a timestamp or a live accessor (a countdown, a match clock, a
replay). It ticks only while it is on screen.

```tsx
<FlipClock />
<FlipClock timeZone="Asia/Tokyo" label="Tokyo" seconds={false} />
<FlipClock hour12 size="lg" color="warning" />
<FlipClock time={() => $end - $now} timeZone="UTC" />          // a countdown: a duration shown as UTC time
<FlipClock separator="." blink={false} parts={{ frame: false }} />
```

## Props

| Prop | |
|---|---|
| `time` | Your own time: a Date, a timestamp (ms) or a live accessor. Default: the system clock. |
| `timeZone` | IANA time zone ("Europe/Istanbul"). Default: the device's. |
| `hour12` | A 12-hour clock with the AM / PM flap. Default: the page language's habit. |
| `seconds` | The seconds cards. Default true. |
| `separator` / `blink` | The text between the groups (":", `false` for none) and whether it blinks once a second (default true). |
| `size` | `"sm"` (24 px cards), `"md"` (40, default), `"lg"` (64) or the card height in px. |
| `color` | Theme color token of the digits. Default: the cards' white ink. |
| `duration` | Flip time of a card (ms). Default 420. |
| `motion` | `false` (or `"none"`): the cards change at once and nothing blinks. Reduced motion does the same. |
| `label` | Accessible name before the spoken time. Default "Clock". |
| `parts` | `{ separators, period, frame }` on or off. |
| `onTick` | Called once a second with the time shown. |
| `class` | Extra class on the root. |

Class hooks: `m-flipclock` (root; `is-blink`, `is-odd` on odd seconds, `m-flipclock-bare`), `m-flipclock-cards`,
`m-flipclock-h`, `m-flipclock-m`, `m-flipclock-s` (the Odometers: `m-odo-*` inside), `m-flipclock-sep`,
`m-flipclock-period` (the SplitFlap). CSS variables: `--m-flipclock-h` (card height), `--m-flipclock-ink`; the cards
take Odometer's `--m-odo-*` variables.

At midnight (23 → 00) the hour cards roll back, as Odometer rolls a smaller number down.

## Accessibility

- The clock is an image (`role="img"`) named "<label>: <time>" with the time to the minute in the page's language
  (`Clock: 14:05`); it changes once a minute and never reads the cards one by one.
- Reduced motion (or `motion={false}`): the cards change without flipping and the separators do not blink.
- The groups always read hours, minutes, seconds from left to right, also in a right-to-left page.

## Composed of

Odometer (`variant="flip"`, two cards per group) and SplitFlap (the 12-hour AM / PM).
