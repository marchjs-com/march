# Gantt

A project timeline. Each task is a bar on a day / week / month scale with its progress filled in; dependency arrows
link a predecessor's end to its successor's start (red and dashed while they overlap). Drag a bar to move it, drag its
ends to resize it, drag the knob under it to set progress. With `cascade`, successors that would start before their
predecessor ends are pushed later, keeping their length. A today line marks the current day; the task names stay
pinned while the timeline scrolls.

```tsx
import { Gantt } from "march/components/data/gantt";

<Gantt tasks={$tasks} scale="day" cascade
  onChange={(task) => api.save(task)}
  onSelect={(task) => open(task)} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `tasks` | `GanttTask[]` / accessor | — | `{ id, name, start, end, progress?, deps?, color?, milestone?, data? }`; dates are ISO days, `end` inclusive |
| `onChange` | `(task) => void` | — | after a drag or keyboard edit, once per changed task (cascaded ones too) |
| `onSelect` | `(task) => void` | — | click / Enter on a bar |
| `scale` | `day` `week` `month` / accessor | `week` | px per day 40 / 18 / 5 |
| `cascade` | boolean | `true` | push successors later |
| `editable` | boolean | `true` | drag, resize, progress, keyboard edits |
| `arrows` | boolean | `true` | dependency arrows |
| `height` | px | `420` | |
| `rowHeight` | px | `36` | |
| `todayLine` | boolean / accessor | `true` | the today line and its label |
| `names` | boolean | `true` | the pinned column of task names |
| `help` | boolean / node | `true` | the hint under the chart: the text of `labels`, off, or your own node |
| `barLabel` | `(task) => node` | the task name | content of a bar |
| `labels` | `Partial<GanttLabels>` | built-in texts | `today`, `task`, `help`, `helpReadonly`, and the functions `days(n)`, `done(percent)`, `after(names)`, `moved(name, start, end)`, `pushed(n)` |
| `animate` | `AnimateProp` | `true` | change animation: `true` (a spring), `false`, an easing name or `{ duration, easing, stagger, delay, enter, update, exit }` (see Motion) |
| `label` | string | "Project timeline" | accessible name |
| `class` | class | — | extra class on the root |

```tsx
<Gantt tasks={$tasks} names={false} help={false} todayLine={false} animate={false}
  barLabel={(task) => <>{task.name} · {Math.round((task.progress ?? 0) * 100)}%</>}
  labels={{ today: "Now", task: "Work item", days: (n) => `${n} days` }} />
```

Dates come from `core/date` (`diffDays`, `addDays`, `startOfWeek`, `dateFormat` …), drags from `pointerDrag`
(march/motion).

## Accessibility

Each bar is a button named with the task, its dates, progress and predecessors. One bar is in the tab order; ↑ ↓ move
between tasks, Enter selects, Alt+← → moves a task by a day and Alt+Shift+← → changes its end (mirrored in RTL); every
change is announced. Hovering or focusing a bar highlights its row and its arrows. The arrows draw themselves in, a
dropped bar settles with a spring and pushed tasks glide to their new place — all on the motion engine, so reduced
motion and the global pause apply.

## Motion

- When `tasks` change, every bar glides from where it was drawn to its new dates and row (a pushed successor slides
  along, a task whose predecessor was removed moves up a row); the dependency arrows hang on the drawn bars and follow.
- While you drag, the bar follows the pointer at once; when you drop it, it stays where it was dropped and settles with
  a small pop. A cancelled drag glides home.
- New tasks grow in from their start day (with `stagger`, row after row on the first drawing); removed tasks fade out
  where they were, then go.
- A scale change places the bars at once and fades the canvas in; the arrows draw themselves in.
- `animate={false}` turns all of it off; reduced motion jumps; global speed and pause apply (motion engine).

## Composed of

ListRow (the task names), ResizeHandle (the ends of a bar), Badge (the label of the today line) and LiveStatus (the hint
under the chart and the hidden status region); dates and drags come from the shared engines above.
