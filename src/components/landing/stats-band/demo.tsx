// Showcase stage for StatsBand.
import { StatsBand, type StatItem } from "./index.ts";

export const code = `<StatsBand items={[
  { value: 250000, label: "kişi", format: { notation: "compact" }, suffix: "+" },
  { value: 1200, label: "etkinlik her hafta" },
]} />`

export const STATS: StatItem[] = [
  { value: 250000, label: "kişi HADİ'de", format: { notation: "compact" }, suffix: "+" },
  { value: 1200, label: "etkinlik her hafta" },
  { value: 4.8, decimals: 1, label: "uygulama puanı", note: "5 üzerinden" },
  { value: 81, label: "ilde etkinlik" },
]

export default function StatsBandDemo(props: { values: { variant: string; mode: string } }) {
  return <div>
    {() => { const v = { ...props.values }; return <StatsBand variant={v.variant as "plain"} mode={v.mode as "count"} items={STATS} /> }}
  </div>
}
