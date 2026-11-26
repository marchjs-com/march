# TimeInput

The browser's own time field: the value is `"HH:MM"` (`"HH:MM:SS"` with a step under a minute), in the user's
12- or 24-hour display. With `picker="clock"` a clock button beside it opens a clock dial, as on Android: press or
drag on the face to pick the hour (24-hour clocks: 1–12 outside, 13–00 inside), it turns to the minutes, and the
minute you pick closes it. 12-hour clocks get an AM / PM switch.

```tsx
<Field label="Start"><TimeInput bind:value={$start} min="09:00" max="18:00" /></Field>
<Field label="Alarm"><TimeInput bind:value={$alarm} picker="clock" hour12 /></Field>
<TimeInput bind:value={$slot} picker="clock" step={900} min="08:00" max="20:00" labels={{ choose: "Pick a slot" }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | string | `""` | |
| `min`, `max` | `"HH:MM"` | — | |
| `step` | seconds | — | `1` shows seconds; with the dial, a step of whole minutes snaps the minutes (`900`: every 15) |
| `picker` | `"native"` · `"clock"` | `"native"` | `"clock"`: a clock button and the clock dial |
| `hour12` | boolean | from the locale | the dial as a 12-hour clock with AM / PM |
| `locale` | string | the app locale | the dial's 12 / 24 hours and its AM / PM texts |
| `icon` | node / text / `() => node` | a clock | the button's icon |
| `labels` | `{ choose?, hours?, minutes? }` | "Choose time", "Hours", "Minutes" | accessible names |
| `disabled`, `readonly` | boolean | — | |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

## Typing (march/mask)

The time is typed on march/mask's time kind (24 hours): the colon comes by itself, a single 7 becomes 07, hour 25 and
minute 7x cannot be typed (a short shake; `motion={false}` turns it off), seconds appear when `step` is under a minute,
a complete time outside `min` / `max` is written and marked (as on a native time field), and a half-typed time is put back when the field is left.

## Accessibility

A real text `<input>` with the numeric keypad (`inputmode="numeric"`) and the same typing in every browser; screen readers hear errors, not each digit.

The clock dial opens in a dialog named by `labels.choose` (Alt+ArrowDown in the field opens it too). Its face is a
slider: "Hours", then "Minutes", with the time as its value text; the arrow keys step, Page Up / Down jump (3 hours,
5 minutes), Home / End go to the ends, Enter moves on to the minutes and then closes; Escape closes and returns to the
field. The hour and minute parts on top are toggle buttons that switch the face. Times outside `min` / `max` are
dimmed and cannot be picked.

## Composed of

A styled input with the `mask` behavior (march/mask time kind); with `picker="clock"`, IconButton (the clock button) and Popover (the dial's panel).
