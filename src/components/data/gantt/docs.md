# Gantt

A project timeline. Each task is a bar on a day / week / month scale with its progress filled in; dependency arrows
link a predecessor's end to its successor's start (red and dashed while they overlap). Drag a bar to move it, drag its
ends to resize it, drag the knob under it to set progress. With `cascade`, successors that would start before their
predecessor ends are pushed later, keeping their length. A today line marks the current day; the task names stay
pinned while the timeline scrolls.

```tsx
import { Gantt } from "hadi-march/components/data/gantt";

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
| `animate` | boolean | `true` | arrow drawing, settle and scale-change animations |
| `label` | string | "Project timeline" | accessible name |
| `class` | class | — | extra class on the root |

```tsx
<Gantt tasks={$tasks} names={false} help={false} todayLine={false} animate={false}
  barLabel={(task) => <>{task.name} · {Math.round((task.progress ?? 0) * 100)}%</>}
  labels={{ today: "Now", task: "Work item", days: (n) => `${n} days` }} />
```

Dates come from `core/date` (`diffDays`, `addDays`, `startOfWeek`, `dateFormat` …), drags from `pointerDrag`
(hadi-march/motion).

## Accessibility

Each bar is a button named with the task, its dates, progress and predecessors. One bar is in the tab order; ↑ ↓ move
between tasks, Enter selects, Alt+← → moves a task by a day and Alt+Shift+← → changes its end (mirrored in RTL); every
change is announced. Hovering or focusing a bar highlights its row and its arrows. The arrows draw themselves in, a
dropped bar settles with a spring and pushed tasks fade in at their new place — all on the motion engine, so reduced
motion and the global pause apply.

## Composed of

Its own parts only (bars, arrows, header); dates and drags come from the shared engines above.
