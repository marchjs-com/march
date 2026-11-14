// Showcase stage for Kanban: drag cards (or Alt+← / Alt+→); column count and tones follow the Playground values.
import { Kanban, type KanbanColumn } from "./index.ts";
import { Chip } from "../../actions/chip/index.ts";
import { Icon } from "../../../icons/index.ts";
import { layers } from "../../../icons/glyphs/layers.ts";

export const code = `<Kanban columns={$board} itemKey={(x) => x.id} card={(x) => <strong>{x.title}</strong>}
  onMove={(item, from, to) => { $board = move($board, item, from, to) }} />
// column: { id, title, tone?, color?, items } — drag and drop, or Alt+← / Alt+→ on a focused card
// dot={false} count={(col) => col.items.length + " iş"} animate={false}: every part is optional or yours`

interface Task { id: string; title: string; tag: string }
const COLS = [
  { id: "todo", title: "Yapılacak", tone: "info", items: [{ id: "t1", title: "Tema seçiciyi üst çubuğa al", tag: "Arayüz" }, { id: "t2", title: "Tablo dışa aktarma", tag: "Veri" }] },
  { id: "doing", title: "Sürüyor", tone: "warn", items: [{ id: "t3", title: "Koyu tema kontrastı", tag: "Erişilebilirlik" }] },
  { id: "review", title: "İncelemede", tone: "primary", items: [{ id: "t6", title: "Fatura ekranı", tag: "Ödeme" }] },
  { id: "done", title: "Bitti", tone: "success", items: [{ id: "t4", title: "Yazı tipleri", tag: "Tipografi" }, { id: "t5", title: "İkon seti", tag: "İkon" }] },
]

const BRAND: Record<string, "brand-blue" | "brand-orange" | "brand-purple" | "brand-green"> = { todo: "brand-blue", doing: "brand-orange", review: "brand-purple", done: "brand-green" }

export default function KanbanDemo(props: { values: { columns: number; tones: boolean; dot: string; count: string; animate: boolean } }) {
  let $board: KanbanColumn<Task>[] = COLS
  const move = (it: Task, from: string, to: string) => {
    $board = $board.map((c) => (c.id === from ? { ...c, items: c.items.filter((x) => x.id !== it.id) } : c.id === to ? { ...c, items: [...c.items, it] } : c))
  }
  const shown = () => {
    const v = props.values
    const ids = v.columns === 2 ? ["todo", "done"] : v.columns === 3 ? ["todo", "doing", "done"] : ["todo", "doing", "review", "done"]
    return $board.filter((c) => ids.includes(c.id)).map((c) => ({ ...c, tone: v.tones ? c.tone : undefined, color: v.dot === "brand" ? BRAND[c.id] : undefined }))
  }
  // dot, count and the entrance are read once by the board: it is drawn again when one of them changes
  return <div>{() => {
    const dot = props.values.dot, count = props.values.count, animate = props.values.animate
    return <Kanban columns={shown} itemKey={(x: Task) => x.id} onMove={move} animate={animate}
      dot={dot === "off" ? false : dot === "own" ? () => <Icon of={layers} size="sm" /> : true}
      count={count === "off" ? false : count === "own" ? (c: KanbanColumn<Task>) => `${c.items.length} iş` : true}
      card={(x: Task) => <div class="sc-col">
        <strong>{x.title}</strong>
        <div class="sc-row"><Chip size="sm">{x.tag}</Chip></div>
      </div>} />
  }}</div>
}
