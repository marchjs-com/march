// Showcase stage for Slider: step, how the value is shown and the track (the browser's, a color ramp, your own node).
import { Slider } from "./index.ts";
import { Field } from "../../../forms/field.ts";
import { Progress } from "../../feedback/progress/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
type Opt<T> = T | undefined

export const code = `<Field label="Ses"><Slider bind:value={$vol} min={0} max={100} step={5} format={(v) => \`%\${v}\`} /></Field>
<Slider bind:value={$vol} track />                                  // renk rampası
<Slider bind:value={$hue} max={360} track="ton-seridi" showValue={false} aria-label="Ton" />   // .ton-seridi { background: linear-gradient(…) }
<Slider bind:value={$vol} track={<Progress value={100} colors="brand" paint="segments" />} />  // kendi düğümün`

export default function SliderDemo(props: { values: { step: number; format: string; showValue: boolean; track: string; color: string } }) {
  let $vol = 60
  return <div>{() => {
    const v = { ...props.values }
    const format = v.format === "percent" ? (x: number) => `%${x}` : v.format === "level" ? (x: number) => (x < 34 ? "düşük" : x < 67 ? "orta" : "yüksek") : undefined
    const track = v.track === "ramp" ? true : v.track === "node" ? <Progress value={100} colors="brand" paint="segments" /> : undefined
    const color = (v.color || undefined) as Opt<ColorToken>
    return <Field label="Ses"><Slider value={$vol} onChange={(x: number) => { $vol = x }} min={0} max={100} step={v.step} format={format} showValue={v.showValue} track={track} color={color} /></Field>
  }}</div>
}
