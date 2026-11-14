// Showcase stage for Badge: kind, tone and count follow the Playground values (playground.ts).
import { Badge } from "./index.ts";
import { Icon } from "../../../icons/index.ts";
import { heart } from "../../../icons/glyphs/heart.ts";

export const code = `<Badge tone="success">Etkin</Badge>
<Badge tone="warn" dot>Bekliyor</Badge>
<Badge dot dotColor="brand-orange">Canlı</Badge>      // dot={<Icon of={heart} />}: your own mark
<Badge count={$unread} label="okunmamış" />          // hidden at 0, 120 → "99+"`

const LABEL: Record<string, string> = { neutral: "Taslak", primary: "Yeni", info: "Davetli", success: "Etkin", warn: "Bekliyor", danger: "Askıda" }

export default function BadgeDemo(props: { values: { mode: string; tone: string; dot: string; count: number; showZero: boolean; format: string } }) {
  return <div class="sc-row">
    {() => {
      const v = props.values
      if (v.mode === "count") return [<span class="hm-muted">Gelen kutusu</span>, <Badge count={v.count} tone={v.tone} showZero={v.showZero} label="okunmamış" format={v.format === "own" ? (n: number) => `${n} yeni` : undefined} />]
      const dot = () => (v.mode !== "dot" ? false : v.dot === "own" ? <Icon of={heart} /> as Node : true)
      const dotColor = v.dot === "tone" || v.dot === "own" ? undefined : v.dot as "brand-orange"
      return ["HADİ", "Globex", "Initech"].map((n) => <span class="sc-row">{n}<Badge tone={v.tone} dot={dot()} dotColor={dotColor}>{LABEL[v.tone]}</Badge></span>)
    }}
  </div>
}
