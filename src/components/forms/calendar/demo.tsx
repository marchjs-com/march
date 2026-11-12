// Showcase stage for Calendar: first weekday and an allowed window.
import { Calendar } from "./index.ts";
import { todayIso, addDays } from "../../../core/date.ts";
// unions live outside JSX: the March compiler reads `|` in a JSX expression as a pipe
type Maybe<T> = T | null | undefined

export const code = `<Calendar bind:value={$day} firstDay={1} min={todayIso()} max={addDays(todayIso(), 30)} />`

export default function CalendarDemo(props: { values: { firstDay: string; window: boolean } }) {
  let $day = todayIso()
  return <div class="sc-stack">
    {() => {
      const v = props.values, today = todayIso()
      return <Calendar value={$day} onChange={(x: Maybe<string>) => { $day = x ?? today }} firstDay={v.firstDay === "locale" ? undefined : Number(v.firstDay)}
        min={v.window ? addDays(today, -3) : undefined} max={v.window ? addDays(today, 10) : undefined} />
    }}
    <p class="hm-muted">{() => `Seçilen: ${$day}`}</p>
  </div>
}
