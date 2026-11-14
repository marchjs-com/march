# Calendar

A month grid. Dates are plain ISO strings (`"2026-03-14"`) and the arithmetic runs in UTC, so a daylight-saving change
never shifts a day. The first weekday and the names come from the locale; days outside `min` / `max` or matched by
`isDisabled` cannot be picked; `rangeFrom` / `rangeTo` highlight a range.

```tsx
<Calendar bind:value={$day} min="2026-03-10" max="2026-04-20" />
<Calendar value={$from} rangeFrom={$from} rangeTo={$to} isDisabled={(iso) => holidays.has(iso)} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | `IsoDate \| null` | `null` | |
| `min`, `max` | IsoDate | — | |
| `firstDay` | 0–6 | from the locale | 0 = Sunday |
| `locale` | string | app locale | |
| `initial` | IsoDate | today | month shown with no value |
| `isDisabled` | `(iso) => boolean` | — | |
| `rangeFrom`, `rangeTo` | IsoDate | — | highlight |
| `onPick`, `onEscape` | functions | — | |
| `autoFocus` | boolean | — | focus the current day |
| `labels` | `{ prevMonth?, nextMonth? }` | "Previous month" / "Next month" | names of the month buttons |
| `nav` | boolean | `true` | `false` removes the month buttons (PageUp / PageDown still work) |
| `prevIcon`, `nextIcon` | node, text or `() => node` | chevrons | content of the month buttons |
| `weekdays` | boolean | `true` | `false` removes the weekday row |
| `renderDay` | `(iso, day) => node` | the day number | content of a day cell |
| `class`, `color` | | — | `color` is a theme token (selection, today ring, range) |

Every part is yours: `<Calendar bind:value={$day} color="brand-orange" weekdays={false} prevIcon="‹" nextIcon="›"
labels={{ prevMonth: "Önceki ay", nextMonth: "Sonraki ay" }} renderDay={(iso, d) => busy.has(iso) ? <b>{d}</b> : d} />`.

## Accessibility

A `role="grid"` labelled by the month title (a polite live region); one day is in the Tab order. Arrows move by day and
week, Page Up / Down by month (with Shift by year), Home / End to the week's start and end, Enter or Space picks;
today is `aria-current="date"`, picked days are `aria-selected`, unavailable ones `aria-disabled`.

## Composed of

Nothing: calendar math lives in core/date.ts (shared with Scheduler and Gantt).
