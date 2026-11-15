// Showcase stage for Gantt: a product launch plan around today (neutral demo data).
import { signal, computed, untrack } from "march";
import { Gantt, type GanttTask } from "./index.ts";
import { Button } from "../../../ui/button.ts";
import { todayIso, addDays } from "../../../core/date.ts";

export const code = `<Gantt tasks={$tasks} scale="day" cascade
  onChange={(task) => api.save(task)}
  onSelect={(task) => open(task)} />

// a task: { id, name, start, end, progress, deps: ["design"], color, milestone }
// names={false} help={false} todayLine={false} animate={false} barLabel={(task) => …} labels={{ today: "Şimdi", days: (n) => n + " gün" }}`

const PLAN: [id: string, name: string, from: number, days: number, progress: number, deps: string[], color: string, milestone?: boolean][] = [
  ["brief", "Kapsam ve hedefler", -12, 4, 1, [], "brand-purple"],
  ["research", "Kullanıcı araştırması", -8, 6, 1, ["brief"], "brand-purple"],
  ["design", "Arayüz tasarımı", -2, 7, 0.6, ["research"], "brand-blue"],
  ["api", "API ve veri modeli", -1, 9, 0.45, ["research"], "brand-green"],
  ["web", "Web uygulaması", 6, 10, 0.1, ["design", "api"], "brand-orange"],
  ["mobile", "Mobil uygulama", 8, 12, 0, ["design", "api"], "brand-orange"],
  ["qa", "Test ve düzeltmeler", 21, 6, 0, ["web", "mobile"], "brand-gold"],
  ["docs", "Belgeler", 18, 7, 0, ["web"], "brand-green"],
  ["beta", "HADİ ile beta", 27, 1, 0, ["qa"], "brand-pink", true],
  ["launch", "Yayın", 30, 1, 0, ["beta", "docs"], "brand-orange", true],
];

export default function GanttDemo(props: { values: { scale: string; arrows: boolean; cascade: boolean; editable: boolean; todayLine: boolean; names: boolean; help: string; barLabel: string; animate: boolean } }) {
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
  const once = computed(() => [props.values.names, props.values.help, props.values.barLabel, props.values.animate].join("|"))
  const parts = () => { once(); return untrack(() => [props.values.names, props.values.help, props.values.barLabel, props.values.animate] as const) }
  return <div class="sc-stage" ref={(el: Element) => { stage = el as HTMLElement }}>
    {() => (props.values.editable ? <div class="sc-row"><Button size="sm" variant="secondary" data-audit-try on:click={delay}>Tasarımı 3 gün ertele (Alt+→)</Button></div> : null)}
    {() => {
      // parts read once by the chart (names column, hint, bar text, motion): it is drawn again only when one of them
      // changes; scale, arrows and the rest stay live on the same chart
      const [names, help, bar, animate] = parts()
      return untrack(() => <Gantt tasks={tasks} scale={() => props.values.scale as "day"} arrows={() => props.values.arrows} cascade={() => props.values.cascade}
        editable={() => props.values.editable} height={430} label="Ürün yayın planı"
        todayLine={() => props.values.todayLine} names={names} animate={animate}
        help={help === "off" ? false : help === "own" ? "Çubuğu sürükleyin; ardıl görevler kendiliğinden kayar." : true}
        barLabel={bar === "own" ? (task: GanttTask) => `${task.name} · %${Math.round((task.progress ?? 0) * 100)}` : undefined}
        labels={{ days: (n: number) => `${n} gün` }}
        onChange={(task: GanttTask) => { tasks.set(tasks().map((x) => (x.id === task.id ? task : x))); last.set(`Güncellendi: ${task.name}`) }}
        onSelect={(task: GanttTask) => last.set(`Seçildi: ${task.name}`)} />)
    }}
    <p role="status">{last}</p>
  </div>
}
