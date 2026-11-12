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

## Accessibility

The calendar button says "Choose date" and has `aria-haspopup="dialog"` / `aria-expanded`; Alt+ArrowDown (or
ArrowDown in an empty field) opens it, the popover is a dialog that focuses the current day, and Escape or a pick
closes it and returns focus to the field.

## Composed of

Calendar (in the popover, placed by the shared floating panel).
