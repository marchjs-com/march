// Showcase stage for Chip: draws the chips for the Playground values (playground.ts). Code is shown in the Code tab.
import { Chip } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { heart } from "../../../icons/glyphs/heart.ts";
import { trash } from "../../../icons/glyphs/trash.ts";

export const code = `<Chip>Tasarım</Chip>
<Chip selected={$on} onClick={() => $on = !$on}>Açık</Chip>          // filter: aria-pressed
<Chip tone="primary" onRemove={() => remove(tag)}>{tag}</Chip>       // removable
<Chip m:color="brand-blue" size="sm" selected>Mavi</Chip>
<Chip selected={$on} selectedIcon={heart} onClick={toggle}>Beğenilenler</Chip>   // selectedIcon: false | your own icon
<Chip onRemove={drop} removeIcon={trash} removeLabel="Etiketi sil">{tag}</Chip>`

export default function ChipDemo(props: { values: { tone: string; size: string; mode: string; color: string; selectedIcon: string; removeIcon: string } }) {
  let $on = new Set(["Açık"])
  let $tags = ["Tasarım", "Ürün", "Çok uzun bir etiket adı kayarak okunur"]
  return <div class="sc-row">
    {() => {
      const v = props.values, tone = v.tone as "neutral", size = v.size as "md", color = (v.color || undefined) as ColorToken | undefined
      const selectedIcon = v.selectedIcon === "off" ? false : v.selectedIcon === "own" ? heart : true
      const own = v.removeIcon === "own"
      if (v.mode === "toggle") return ["Açık", "Bekliyor", "Çözüldü"].map((f) => <Chip tone={tone} size={size} m:color={color} selectedIcon={selectedIcon} selected={$on.has(f)} onClick={() => { const n = new Set($on); n.has(f) ? n.delete(f) : n.add(f); $on = n }}>{f}</Chip>)
      if (v.mode === "remove") return $tags.map((t) => <Chip tone={tone} size={size} m:color={color} removeIcon={own ? trash : undefined} removeLabel={own ? "Etiketi sil" : undefined} onRemove={() => { $tags = $tags.filter((x) => x !== t) }}>{t}</Chip>)
      return ["Tasarım", "Ürün", "Pazarlama"].map((t) => <Chip tone={tone} size={size} m:color={color}>{t}</Chip>)
    }}
  </div>
}
