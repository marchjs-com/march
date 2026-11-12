// Showcase stage for Progress: value, colours, paint, tone and size from the Playground values (playground.ts).
import { Progress } from "./index.ts";

export const code = `<Progress value={$p} label="Yükleniyor" showValue />
<Progress />                                              // belirsiz
<Progress value={60} paint="segments" colors="brand" />
<Progress paint="cycle" colors={["brand-blue", "brand-green"]} />`

const COLORS: Record<string, "single" | "brand" | ("brand-blue" | "brand-green")[]> = { tone: "single", brand: "brand", pair: ["brand-blue", "brand-green"] }

export default function ProgressDemo(props: { values: { indeterminate: boolean; value: number; colors: string; paint: string; tone: string; size: string; showValue: boolean } }) {
  return <div class="sc-col">
    {() => {
      const v = props.values
      return <Progress value={v.indeterminate ? null : v.value} label={v.indeterminate ? "Hazırlanıyor" : "Yükleniyor"} showValue={v.showValue && !v.indeterminate}
        size={v.size as "md"} tone={v.colors === "tone" ? (v.tone as "primary") : undefined} colors={COLORS[v.colors]} paint={v.colors === "tone" ? undefined : (v.paint as "gradient")} />
    }}
  </div>
}
