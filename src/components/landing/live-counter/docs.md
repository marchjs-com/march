# LiveCounter

A number that grows while you watch. Feed it a live value (a signal from your server), or give it a start and a `rate`
per minute: it then adds small random steps on the motion clock, only while it is on screen. The digits roll like an
odometer and a pulsing dot marks it as live.

```tsx
<LiveCounter value={$online} label="people online" />
<LiveCounter from={18420} rate={40} label="joined an event this week" format={{ notation: "compact" }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | number / accessor | — | the live value |
| `from` | number | `0` | start of the simulated growth |
| `rate` | number | — | average increase per minute (simulated) |
| `label` | node | — | what is counted |
| `prefix`, `suffix` | node | — | around the number |
| `format` | Intl.NumberFormatOptions | — | |
| `dot` | boolean | `true` | the pulsing live dot |
| `random` | `() => number` | `Math.random` | step source (tests) |

## Accessibility

The number is a Counter: screen readers read the current value as text, the rolling digits are hidden from them; it
is not a live region, so it never interrupts. The dot is decorative. The simulation runs on the motion clock: it stops
off screen and with the global motion pause. Reduced motion: digits change without rolling, the dot stops pulsing.

## Composed of

Counter (roll mode), the motion engine (`onFrame`), `IntersectionObserver`.
