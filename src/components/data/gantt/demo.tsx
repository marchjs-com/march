// Showcase stage for Gantt: a product launch plan around today (neutral demo data).
import { signal } from "hadi-march";
import { Gantt, type GanttTask } from "./index.ts";
import { Button } from "../../../ui/button.ts";
import { todayIso, addDays } from "../../../core/date.ts";

export const code = `<Gantt tasks={$tasks} scale="day" cascade
  onChange={(task) => api.save(task)}
  onSelect={(task) => open(task)} />

// a task: { id, name, start, end, progress, deps: ["design"], color, milestone }`

const PLAN: [id: string, name: string, from: number, days: number, progress: number, deps: string[], color: string, milestone?: boolean][] = [
  ["brief", "Kapsam ve hedefler", -12, 4, 1, [], "brand-purple"],
  ["research", "Kullanıcı araştırması", -8, 6, 1, ["brief"], "brand-purple"],
  ["design", "Arayüz tasarımı", -2, 7, 0.6, ["research"], "brand-blue"],
  ["api", "API ve veri modeli", -1, 9, 0.45, ["research"], "brand-green"],
  ["web", "Web uygulaması", 6, 10, 0.1, ["design", "api"], "brand-orange"],
  ["mobile", "Mobil uygulama", 8, 12, 0, ["design", "api"], "brand-orange"],
  ["qa", "Test ve düzeltmeler", 21, 6, 0, ["web", "mobile"], "brand-gold"],
  ["docs", "Belgeler", 18, 7, 0, ["web"], "brand-green"],
  ["beta", "Acme ile beta", 27, 1, 0, ["qa"], "brand-pink", true],
  ["launch", "Yayın", 30, 1, 0, ["beta", "docs"], "brand-orange", true],
];

export default function GanttDemo(props: { values: { scale: string; arrows: boolean; cascade: boolean; editable: boolean } }) {
  const t0 = todayIso()
  const plan = (): GanttTask[] => PLAN.map(([id, name, from, days, progress, deps, color, milestone]) =>
    ({ id, name, start: addDays(t0, from), end: addDays(t0, from + days - 1), progress, deps, color: color as "brand-blue", milestone }))
  const tasks = signal<GanttTask[]>(plan())
  const last = signal("")
  let stage: HTMLElement | undefined
  // the plan as it was, then "Arayüz tasarımı" three days later with the keyboard gesture (Alt+→): with "Ardılları it"
  // the web and mobile tasks move after it, without it they stay and overlap
  const delay = () => {
    tasks.set(plan())
    queueMicrotask(() => {
      const bar = stage?.querySelector<HTMLElement>('[data-task="design"]')
      if (!bar) return
      bar.focus()
      for (let i = 0; i < 3; i++) bar.dispatchEvent(new KeyboardEvent("keydown", { key: getComputedStyle(bar).direction === "rtl" ? "ArrowLeft" : "ArrowRight", altKey: true, bubbles: true }))
    })
  }
  return <div class="sc-stage" ref={(el: HTMLElement) => { stage = el }}>
    {() => (props.values.editable ? <div class="sc-row"><Button size="sm" variant="secondary" data-audit-try on:click={delay}>Tasarımı 3 gün ertele (Alt+→)</Button></div> : null)}
    <Gantt tasks={tasks} scale={() => props.values.scale as "day"} arrows={() => props.values.arrows} cascade={() => props.values.cascade}
      editable={() => props.values.editable} height={430} label="Ürün yayın planı"
      onChange={(task: GanttTask) => { tasks.set(tasks().map((x) => (x.id === task.id ? task : x))); last.set(`Güncellendi: ${task.name}`) }}
      onSelect={(task: GanttTask) => last.set(`Seçildi: ${task.name}`)} />
    <p role="status">{last}</p>
  </div>
}
