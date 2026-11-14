// Showcase stage for Calendar: first weekday, an allowed window, the color, and the parts you can switch off or redraw
// (weekday row, month buttons, day content).
import { Calendar } from "./index.ts";
import { todayIso, addDays } from "../../../core/date.ts";
// unions live outside JSX: the March compiler reads `|` in a JSX expression as a pipe
type Maybe<T> = T | null | undefined

export const code = `<Calendar bind:value={$day} firstDay={1} min={todayIso()} max={addDays(todayIso(), 30)} />
<Calendar bind:value={$day} color="brand-orange" weekdays={false} prevIcon="«" nextIcon="»"
  labels={{ prevMonth: "Önceki ay", nextMonth: "Sonraki ay" }} renderDay={(iso, d) => busy.has(iso) ? <b>{d}•</b> : d} />`

export default function CalendarDemo(props: { values: { firstDay: string; window: boolean; color: string; weekdays: boolean; nav: string; busy: boolean } }) {
  let $day = todayIso()
  return <div class="sc-stack">
    {() => {
      const v = props.values, today = todayIso()
      return <Calendar value={$day} onChange={(x: Maybe<string>) => { $day = x ?? today }} firstDay={v.firstDay === "locale" ? undefined : Number(v.firstDay)}
        min={v.window ? addDays(today, -3) : undefined} max={v.window ? addDays(today, 10) : undefined}
        color={v.color === "primary" ? undefined : (v.color as "brand-blue")} weekdays={v.weekdays} nav={v.nav !== "off"}
        prevIcon={v.nav === "own" ? "«" : undefined} nextIcon={v.nav === "own" ? "»" : undefined} labels={{ prevMonth: "Önceki ay", nextMonth: "Sonraki ay" }}
        renderDay={v.busy ? (_iso: string, d: number) => (d % 4 === 0 ? <b>{`${d}•`}</b> : d) : undefined} />
    }}
    <p class="hm-muted">{() => `Seçilen: ${$day}`}</p>
  </div>
}
