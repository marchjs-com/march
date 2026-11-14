# PeriodNav

Previous · today · next: the small group a calendar steps its period with. Without a title the three buttons are one
joined control (the Scheduler bar); with a `title` the period's name sits between the arrows (the month row of a
Calendar) and the today button follows. The arrows swap in right-to-left text.

```tsx
<PeriodNav onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={() => go(today)} />
<PeriodNav title={$monthName} onPrev={back} onNext={on} />
<PeriodNav title={$monthName} onPrev={back} onNext={on} onToday={now} today="This month" m:color="brand-orange"
  prevIcon={arrowLeft} nextIcon={arrowRight} labels={{ group: "Month", previous: "Previous month", next: "Next month" }} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `onPrev`, `onNext` | `() => void` | | the arrows |
| `onToday` | `() => void` | | shows the today button and runs on it |
| `today` | `false` / text / node / `() => node` | the `today` label | `false` removes the button; anything else is its content |
| `title` (or children) | text / node / accessor | | the period's name between the arrows |
| `labels` | `{ group?, previous?, today?, next? }` | "Period", "Previous", "Today", "Next" (translated) | texts and accessible names; each a string or an accessor |
| `prevIcon`, `nextIcon` | icon / text / node / `() => node` | chevrons | own arrow content (drawn as given, no right-to-left swap) |
| `arrows` | boolean | `true` | `false`: no arrows |
| `prevDisabled`, `nextDisabled` | boolean / accessor | `false` | the first / last period |
| `rtl` | boolean / accessor | direction of the app | the default chevrons swap |
| `attached` | boolean | `true` without a title | buttons joined into one control |
| `size` | `sm` `md` | `md` | size of the arrows |
| `m:color` | color token | accent | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `partClass` | `{ prev, next, today, title }` | | an extra class on a part (a host that keeps its own class names) |
| `class` | class value | | |

## Accessibility

A `group` named "Period" (your `labels.group`). The arrows are icon buttons named "Previous" / "Next" (your labels),
the today button is a text button; all are in the Tab order and work with Enter / Space. The title is plain text: a
host that wants changes read gives it a live element (Calendar does). In right-to-left text the chevrons point the
other way while "previous" stays first in reading order.

## Composed of

ButtonGroup (the group), IconButton (the arrows) and Button (the today button).
