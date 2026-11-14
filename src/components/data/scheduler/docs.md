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
| `step` | minutes | `15` | snap for moves and resizes; while editable the hour gutter shows it as ruler ticks |
| `hourHeight` | px | `48` | |
| `startHour` | hour | `8` | scrolled into view first (the current time when today is in view) |
| `weekends` | boolean | `true` | Saturday and Sunday in week view |
| `editable` | boolean | `true` | drag, resize, create |
| `height` | px | `600` | week / day scroll height |
| `locale` | string | app locale | date locale (names, first weekday, clock, direction) |
| `toolbar` | boolean | `true` | the bar with period buttons, title and view switch |
| `views` | `SchedulerView[]` / `false` | all three | views offered by the switch; `false` or one view hides it |
| `todayButton` | boolean | `true` | the "Today" button |
| `nowLine` | boolean | `true` | the line at the current time (week / day) |
| `help` | boolean / node | `true` | the hint under the calendar: the text of `labels`, off, or your own node |
| `renderEvent` | `(event, { view, time }) => node` | title, time, place | content of an event |
| `labels` | `Partial<SchedulerLabels>` | built-in texts | `allDay`, `month`, `week`, `day`, `period`, `previous`, `today`, `next`, `view`, `help`, and the functions `more(n)`, `moved(title, day, time)` |
| `animate` | boolean | `true` | slide, view-change and settle animations |
| `label` | string | "Calendar" | accessible name |
| `class` | class | — | extra class on the root |

```tsx
<Scheduler events={$events} views={["week", "day"]} todayButton={false} nowLine={false} help={false} animate={false}
  labels={{ allDay: "Whole day", more: (n) => `${n} hidden` }}
  renderEvent={(event, { time }) => <><b>{event.title}</b> <small>{time}</small></>} />
<Scheduler events={$events} toolbar={false} view={$view} date={$date} />   // your own navigation
```

Calendar math is shared in `core/date` (`monthGrid`, `startOfWeek`, `splitDateTime`, `joinDateTime`, `weekdayNames`,
`formatMinutes`, `dateFormat` …), drags in `pointerDrag` (hadi-march/motion).

## Accessibility

Month and time grids are `role="grid"` with column headers. Month days are one roving tab stop (arrows move, Enter
opens the day). Every event is a button whose name says title, day, time and place. Keyboard edits: Alt+arrows move
(↑ ↓ by `step` in the time grid, ← → by a day, mirrored in RTL), Alt+Shift+↑ ↓ resizes, PageUp / PageDown change the
period; each change is announced in a live region. Changing the period slides the grid in the direction of travel,
dropped events settle with a spring, all on the motion engine (reduced motion and global pause apply).

## Composed of

PanelHeader (the bar), Button, IconButton and ButtonGroup (the period buttons, `period-nav.ts`), Segmented (view switch), ResizeHandle (the ends of an event) and Button (the "+N more" link).
