// Showcase stage for Scheduler: a team calendar around today (neutral demo data). Drag on an empty slot creates.
import { signal } from "hadi-march";
import { Scheduler, type SchedulerEvent, type SchedulerRange } from "./index.ts";
import { todayIso, addDays, startOfWeek } from "../../../core/date.ts";

export const code = `<Scheduler events={$events} view="week" step={15}
  onChange={(event, range) => api.update(event.id, range)}
  onCreate={(range) => $events = [...$events, { id: uid(), title: "Yeni", ...range }]}
  onSelect={(event) => open(event)} />`

const SEED: [day: number, from: string, to: string, title: string, color: string, loc?: string][] = [
  [0, "09:00", "09:30", "Günlük toplantı", "brand-blue", "Oda 2"],
  [0, "10:00", "11:30", "Acme ile ürün demosu", "brand-orange", "Çevrim içi"],
  [0, "10:30", "11:00", "Kod incelemesi", "brand-purple"],
  [1, "09:00", "09:30", "Günlük toplantı", "brand-blue", "Oda 2"],
  [1, "13:00", "15:00", "Tasarım atölyesi", "brand-green", "Stüdyo"],
  [2, "11:00", "12:00", "Globex sözleşmesi", "brand-orange"],
  [2, "14:00", "14:45", "Bire bir", "brand-purple"],
  [3, "09:00", "09:30", "Günlük toplantı", "brand-blue", "Oda 2"],
  [3, "15:30", "17:00", "Sürüm planlama", "brand-green"],
  [4, "12:00", "13:00", "Takım öğle yemeği", "brand-gold", "Kafe"],
  [4, "16:00", "16:30", "Haftalık özet", "brand-blue"],
];

export default function SchedulerDemo(props: { values: { view: string; step: string; locale: string; weekends: boolean; editable: boolean } }) {
  const monday = startOfWeek(todayIso(), 1)
  const events = signal<SchedulerEvent[]>([
    ...SEED.map(([d, a, b, title, color, location], i) => ({ id: `e${i}`, title, start: `${addDays(monday, d)}T${a}`, end: `${addDays(monday, d)}T${b}`, color: color as "brand-blue", location })),
    { id: "trip", title: "Fuar (İzmir)", start: addDays(monday, 2), end: addDays(monday, 4), allDay: true, color: "brand-pink" },
    { id: "rel", title: "Sürüm haftası", start: addDays(monday, 7), end: addDays(monday, 11), allDay: true, color: "brand-green" },
  ])
  const last = signal("")
  let n = 0
  const create = (r: SchedulerRange) => { events.set([...events(), { id: `new${++n}`, title: "Yeni etkinlik", ...r, color: "brand-orange" }]); last.set("Yeni etkinlik eklendi") }
  return <div class="sc-stage">
    <Scheduler events={events} view={() => props.values.view as "week"} locale={() => props.values.locale} height={520}
      step={() => Number(props.values.step)} weekends={() => props.values.weekends} editable={() => props.values.editable}
      onChange={(e: SchedulerEvent) => { events.set(events().map((x) => (x.id === e.id ? e : x))); last.set(`“${e.title}” taşındı`) }} onCreate={create} onSelect={(e: SchedulerEvent) => last.set(`Seçildi: ${e.title}`)} />
    <p role="status">{last}</p>
  </div>
}
