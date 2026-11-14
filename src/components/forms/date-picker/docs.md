# DatePicker

A date typed in the locale's own order (`14.03.2026`, `3/14/2026`) with a Calendar popover. The value is an ISO date
string or `null`; an impossible date (`31.02`) or one outside `min` / `max` marks the field invalid instead of
changing the value. `parseDate` and `formatDate` are the same rules as functions.

```tsx
<Field label="Date"><DatePicker bind:value={$date} min={todayIso()} /></Field>
parseDate("14.3.2026", "de") // "2026-03-14"
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `IsoDate \| null` | `null` | |
| `min`, `max` | IsoDate | — | |
| `firstDay` | 0–6 | locale | |
| `locale` | string | app locale | typing order and placeholder |
| `placeholder` | string | e.g. `DD.MM.YYYY` | |
| `icon` | `false`, node, text or `() => node` | a calendar icon | `false` removes the button (Alt+ArrowDown still opens) |
| `labels` | `{ choose?, prevMonth?, nextMonth? }` | "Choose date" … | names of the button, the popover and the month buttons |
| `calendar` | `Partial<CalendarProps>` | — | extra props for the Calendar (`renderDay`, `weekdays`, `prevIcon`, `isDisabled`…) |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

`<DatePicker bind:value={$d} icon={() => <Icon of={clock} />} labels={{ choose: "Gün seç" }}
calendar={{ weekdays: false, renderDay: (iso, d) => d }} />`; `icon={false}` leaves a plain typed field.

## Accessibility

The calendar button says "Choose date" and has `aria-haspopup="dialog"` / `aria-expanded`; Alt+ArrowDown (or
ArrowDown in an empty field) opens it, the popover is a dialog that focuses the current day, and Escape or a pick
closes it and returns focus to the field.

## Composed of

Calendar in a Popover (anchored to the whole control), IconButton (the calendar button).
