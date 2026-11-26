# Stopwatch

A chronograph: a sweeping seconds hand on a 60-second dial, a 30-minute sub-dial, a digital readout, Start / Stop,
Lap and Reset buttons and a lap list with the best and the worst lap marked. For workouts, cooking, speed runs,
presentations, lab timing. It measures real time (`performance.now`), so the global motion speed or a paused engine
never changes the time it shows; on Reset the hands fly back to zero on a spring, the short way round.

```tsx
<Stopwatch />
<Stopwatch running={$on} onLap={(l) => save(l.lap)} decimals={1} />
<Stopwatch subDial={false} texts={{ start: "Başlat", stop: "Durdur", resume: "Sürdür", lap: "Tur", reset: "Sıfırla", lapName: (n) => `Tur ${n}` }} />
```

## Design: why it composes Gauge and Button (and is not a mode of AnalogClock)

A clock shows the time of day and is only looked at; a stopwatch measures elapsed time and is operated. They share
the dial, not the logic, so both compose Gauge rather than each other. The main dial is a Gauge with a wrapping 60-second
scale and one needle; the 30-minute sub-dial is a small bare Gauge placed on the main dial's face through Gauge's
`inlay`; the readout goes in Gauge's `readout` window; the controls are Buttons. Stopwatch itself only keeps the time
(banked time + the current run), the laps and the beat.

## Props

| Prop | |
|---|---|
| `running` | Runs or stops it from outside (a live value); the buttons still work. |
| `decimals` | Fraction digits of the seconds (0–3). Default 2 (`00:12.34`). |
| `subDial` | The 30-minute sub-dial. Default true. |
| `texts` | `{ start, stop, resume, lap, reset, lapName: (n) => text }`. |
| `size` | Width of the dial in px. Default 240. |
| `color` | Theme color token of the hands. Default `"danger"`. |
| `parts` | `face`, `ticks`, `numbers`, `subDial`, `readout`, `glass`, `controls`, `laps` on or off. |
| `motion` | `false`: the hands step ten times a second and jump back on Reset; reduced motion does the same. |
| `label` | Accessible name of the group. Default "Stopwatch". |
| `onStart` / `onStop` / `onLap` / `onReset` | Events: `onStop(elapsedMs)`, `onLap({ lap, total }, laps)`. |

Class hooks: `m-stopwatch` (+ `is-running`), `m-stopwatch-hand`, `m-stopwatch-sub`, `m-stopwatch-minutes`,
`m-stopwatch-readout`, `m-stopwatch-controls`, `m-stopwatch-toggle`, `m-stopwatch-second` (Lap / Reset),
`m-stopwatch-laps`, `m-stopwatch-lap` (+ `is-best`, `is-worst`), `m-stopwatch-lap-name`, `-time`, `-total`.

## Accessibility

- A `role="group"` named by `label`; the buttons are real Buttons (Tab, Enter, Space), their text says what they do
  now (Start, Stop, Resume, Lap, Reset). The dial is hidden from screen readers.
- A `role="timer"` text holds the time to the whole second (a timer is not live: it is read when visited); the lap
  list is a polite live region, so a new lap is announced.
- The sweep runs on the motion engine's frames and only while on screen; reduced motion (or `motion={false}`) steps
  the hands ten times a second instead.

## Composed of

Gauge, Button.
