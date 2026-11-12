# Scheduler

A month / week / day calendar of events. Drag an event to move it (minutes snap to `step`; across columns it changes
day), drag its edge to resize it, drag on an empty slot to create one. Dates and times are formatted with Intl in the
current locale: month and weekday names, the first day of the week, 12 / 24 hour clock and the reading direction.
Overlapping events share the column width; all-day and multi-day events sit in their own lane as bars.

```tsx
import { Scheduler } from "hadi-march/components/data/scheduler";

<Scheduler events={$events} view="week" step={15}
  onChange={(event, range) => api.update(event.id, range)}
  onCreate={(range) => $events = [...$events, { id: uid(), title: "New", ...range }]}
  onSelect={(event) => open(event)} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `events` | `SchedulerEvent[]` / accessor | — | `{ id, title, start, end, allDay?, color?, location?, data? }`; times are local `"YYYY-MM-DDTHH:mm"`, all-day dates `"YYYY-MM-DD"` (end inclusive) |
| `view` | `month` `week` `day` / accessor | `week` | |
| `onView` | `(view) => void` | — | |
| `date` | ISO date / accessor | today | the date in view |
| `onDate` | `(date) => void` | — | |
| `onChange` | `(event, { start, end, allDay }) => void` | — | after a drag or keyboard move; the calendar already shows it |
| `onCreate` | `(range) => void` | — | drag on an empty slot, click a free slot, double-click a month day |
| `onSelect` | `(event) => void` | — | click / Enter on an event |
| `step` | minutes | `15` | snap for moves and resizes |
| `hourHeight` | px | `48` | |
| `startHour` | hour | `8` | scrolled into view first (the current time when today is in view) |
| `weekends` | boolean | `true` | Saturday and Sunday in week view |
| `editable` | boolean | `true` | drag, resize, create |
| `height` | px | `600` | week / day scroll height |
| `locale` | string | app locale | date locale (names, first weekday, clock, direction) |
| `label` | string | "Calendar" | accessible name |

Calendar math is shared in `core/date` (`monthGrid`, `startOfWeek`, `splitDateTime`, `joinDateTime`, `weekdayNames`,
`formatMinutes`, `dateFormat` …), drags in `pointerDrag` (hadi-march/motion).

## Accessibility

Month and time grids are `role="grid"` with column headers. Month days are one roving tab stop (arrows move, Enter
opens the day). Every event is a button whose name says title, day, time and place. Keyboard edits: Alt+arrows move
(↑ ↓ by `step` in the time grid, ← → by a day, mirrored in RTL), Alt+Shift+↑ ↓ resizes, PageUp / PageDown change the
period; each change is announced in a live region. Changing the period slides the grid in the direction of travel,
dropped events settle with a spring, all on the motion engine (reduced motion and global pause apply).

## Composed of

Button, IconButton, ButtonGroup (period navigation) and Segmented (view switch).
