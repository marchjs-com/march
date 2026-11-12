// Showcase stage for StatsBand.
import { StatsBand, type StatItem } from "./index.ts";

export const code = `<StatsBand items={[
  { value: 12000, label: "ekip", format: { notation: "compact" }, suffix: "+" },
  { value: 99.98, decimals: 2, suffix: "%", label: "çalışma süresi" },
]} />`

export const STATS: StatItem[] = [
  { value: 12000, label: "ekip kullanıyor", format: { notation: "compact" }, suffix: "+" },
  { value: 99.98, decimals: 2, suffix: "%", label: "çalışma süresi", note: "son 12 ay" },
  { value: 14.6, decimals: 1, suffix: " KB", label: "ilk yükleme" },
  { value: 48, label: "ülkede yayında" },
]

export default function StatsBandDemo(props: { values: { variant: string; mode: string } }) {
  return <div>
    {() => { const v = { ...props.values }; return <StatsBand variant={v.variant as "plain"} mode={v.mode as "count"} items={STATS} /> }}
  </div>
}
