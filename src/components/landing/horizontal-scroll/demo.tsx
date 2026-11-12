// Showcase stage for HorizontalScroll: coloured case-study panels.
import { HorizontalScroll } from "./index.ts";

export const code = `<HorizontalScroll label="Vaka çalışmaları" panel="26rem">
  {cases.map((c) => <Card>…</Card>)}
</HorizontalScroll>`

const TONES = ["c1", "c2", "c3", "c4"]

export default function HorizontalScrollDemo(props: { values: { panels: number; panel: string } }) {
  return <div>
    {() => {
      const v = props.values
      return <HorizontalScroll label="Vaka çalışmaları" panel={v.panel}>
        {Array.from({ length: v.panels }, (_, i) => <article class={`sc-hs-panel ${TONES[i % 4]}`}><span>{String(i + 1).padStart(2, "0")}</span><h3>Vaka {i + 1}</h3><p>Sayfa aşağı kayarken paneller yana akar.</p></article>)}
      </HorizontalScroll>
    }}
  </div>
}
