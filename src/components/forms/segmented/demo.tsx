// Showcase stage for Segmented: number of options and the color token.
import { Segmented } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<Segmented bind:value={$view} aria-label="Görünüm"
  options={[{ value: "day", label: "Gün" }, { value: "week", label: "Hafta" }, { value: "month", label: "Ay" }]} />`

const ALL = [{ value: "day", label: "Gün" }, { value: "week", label: "Hafta" }, { value: "month", label: "Ay" }, { value: "quarter", label: "Çeyrek" }, { value: "year", label: "Yıl" }]

export default function SegmentedDemo(props: { values: { count: number; color: string } }) {
  let $view = "week"
  return <div class="sc-stack">
    {() => <Segmented value={$view} onChange={(x: string | null) => { $view = x ?? "day" }} options={ALL.slice(0, props.values.count)} color={(props.values.color || undefined) as ColorToken | undefined} aria-label="Dönem" />}
    <p class="hm-muted">{() => `Seçilen: ${ALL.find((o) => o.value === $view)?.label ?? "—"}`}</p>
  </div>
}
