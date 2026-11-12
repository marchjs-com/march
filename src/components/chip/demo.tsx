// Showcase stage for Chip: draws the chips for the Playground values (playground.ts). Code is shown in the Code tab.
import { Chip } from "./index.ts";
import type { ColorToken } from "../../theme/colors.ts";

export const code = `<Chip>Tasarım</Chip>
<Chip selected={$on} onClick={() => $on = !$on}>Açık</Chip>          // filter: aria-pressed
<Chip tone="primary" onRemove={() => remove(tag)}>{tag}</Chip>       // removable
<Chip color="brand-blue" size="sm" selected>Mavi</Chip>`

export default function ChipDemo(props: { values: { tone: string; size: string; mode: string; color: string } }) {
  let $on = new Set(["Açık"])
  let $tags = ["Tasarım", "Ürün", "Çok uzun bir etiket adı kayarak okunur"]
  return <div class="sc-row">
    {() => {
      const v = props.values, tone = v.tone as "neutral", size = v.size as "md", color = (v.color || undefined) as ColorToken | undefined
      if (v.mode === "toggle") return ["Açık", "Bekliyor", "Çözüldü"].map((f) => <Chip tone={tone} size={size} color={color} selected={$on.has(f)} onClick={() => { const n = new Set($on); n.has(f) ? n.delete(f) : n.add(f); $on = n }}>{f}</Chip>)
      if (v.mode === "remove") return $tags.map((t) => <Chip tone={tone} size={size} color={color} onRemove={() => { $tags = $tags.filter((x) => x !== t) }}>{t}</Chip>)
      return ["Tasarım", "Ürün", "Pazarlama"].map((t) => <Chip tone={tone} size={size} color={color}>{t}</Chip>)
    }}
  </div>
}
