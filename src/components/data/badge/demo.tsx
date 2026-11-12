// Showcase stage for Badge: kind, tone and count follow the Playground values (playground.ts).
import { Badge } from "./index.ts";

export const code = `<Badge tone="success">Etkin</Badge>
<Badge tone="warn" dot>Bekliyor</Badge>
<Badge count={$unread} label="okunmamış" />          // hidden at 0, 120 → "99+"`

const LABEL: Record<string, string> = { neutral: "Taslak", primary: "Yeni", info: "Davetli", success: "Etkin", warn: "Bekliyor", danger: "Askıda" }

export default function BadgeDemo(props: { values: { mode: string; tone: string; count: number; showZero: boolean } }) {
  return <div class="sc-row">
    {() => {
      const v = props.values
      if (v.mode === "count") return [<span class="hm-muted">Gelen kutusu</span>, <Badge count={v.count} tone={v.tone} showZero={v.showZero} label="okunmamış" />]
      return ["Acme", "Globex", "Initech"].map((n) => <span class="sc-row">{n}<Badge tone={v.tone} dot={v.mode === "dot"}>{LABEL[v.tone]}</Badge></span>)
    }}
  </div>
}
