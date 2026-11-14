# LiveCounter

A number that grows while you watch. Feed it a live value (a signal from your server), or give it a start and a `rate`
per minute: it then adds small random steps on the motion clock, only while it is on screen. Every part is yours: how
the digits change, the live dot, the "+N" bubble that rises on every increase, and the small beat of the number.

```tsx
import { splitFlap } from "hadi-march/motion/text"
<LiveCounter value={$online} label="people online" />
<LiveCounter from={18420} rate={40} effect={splitFlap} effectOptions={{ duration: 900 }} dotColor="brand-orange"
  bubble={(diff) => <b>❤ {diff}</b>} beat={false} label="joined an event this week" />
<LiveCounter value={$n} effect="none" dot={false} bubble={false} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | number / accessor | — | the live value |
| `from` | number | `0` | start of the simulated growth |
| `rate` | number | — | average increase per minute (simulated) |
| `pause` | `[min, max]` ms | `[1500, 4500]` | pause between simulated steps |
| `label` | node | — | what is counted |
| `prefix`, `suffix` | node | — | around the number |
| `format` | Intl.NumberFormatOptions | — | |
| `effect` | `"roll"` `"none"` / text animation | `"roll"` | how the digits change: any of hadi-march/motion/text (`splitFlap`, `scramble`, `decode`, `odometer`, `pop`, `glitch`…) |
| `effectOptions` | object | — | options of that animation (a counting one also gets `start`: the previous value) |
| `dot` | boolean / node | `true` | the live dot, or your own mark |
| `dotColor` | color token | `success` | colour of the dot and its pulse |
| `bubble` | boolean / `(diff, text) => node` | `true` | the "+N" bubble, or your own content |
| `bubbleColor` | color token | `success` | colour of the bubble |
| `beat` | boolean | `true` | the number beats once on an increase |
| `random` | `() => number` | `Math.random` | step source (tests) |

## Accessibility

The number is text screen readers read as it is (the odometer and the text animations keep an accessible copy and hide
the moving glyphs); it is not a live region, so it never interrupts. The dot and the bubbles are decorative. The
simulation runs on the motion clock: it stops off screen and with the global motion pause. Reduced motion: digits
change without animation, no bubble or beat, the dot stops pulsing.

## Composed of

Counter (roll mode), StatusDot (the live dot), Badge (the "+N" bubble), a text animation of hadi-march/motion/text when given, the motion engine (`onFrame`, `animate`), `whenVisible`.
