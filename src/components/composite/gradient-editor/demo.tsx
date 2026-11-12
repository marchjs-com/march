// Showcase stage for GradientEditor: the editor and a banner painted with its value, for the Playground values (playground.ts).
import { setStyle } from "../../../core/util.ts";
import { effect, untrack } from "../../../core/reactive.ts";
import { GradientEditor } from "./index.ts";

const START: Record<string, string> = {
  hadi: "linear-gradient(120deg, #f2801f 0%, #1d9ad6 35%, #78be3a 65%, #a3338c 100%)",
  radial: "radial-gradient(circle, #ffd27a 0%, #f2801f 55%, #a3338c 100%)",
  conic: "conic-gradient(from 90deg, #1d9ad6 0%, #78be3a 50%, #1d9ad6 100%)",
}

export default function GradientEditorDemo(props: { values: { start: string; presets: boolean; output: boolean; readonly: boolean } }) {
  let $g: string = START.hadi ?? ""
  const banner = (<div class="sc-ge-banner"><b>Acme</b><span>Yeni sezon</span></div>) as HTMLElement
  effect(() => setStyle(banner, { "--sc-ge": $g }))
  return <div class="sc-ed-split">
    {() => { $g = START[props.values.start] ?? START.hadi ?? ""; return <GradientEditor value={untrack(() => $g)} onChange={(v: string) => { $g = v }} presets={props.values.presets ? undefined : false} output={props.values.output} readonly={props.values.readonly} /> }}
    {banner}
  </div>
}
