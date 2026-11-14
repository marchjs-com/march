// Showcase stage for Slider: step and how the value is shown.
import { Slider } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Ses"><Slider bind:value={$vol} min={0} max={100} step={5} format={(v) => \`%\${v}\`} /></Field>`

export default function SliderDemo(props: { values: { step: number; format: string; showValue: boolean } }) {
  let $vol = 60
  return <div>{() => {
    const v = props.values
    const format = v.format === "percent" ? (x: number) => `%${x}` : v.format === "level" ? (x: number) => (x < 34 ? "düşük" : x < 67 ? "orta" : "yüksek") : undefined
    return <Field label="Ses"><Slider value={$vol} onChange={(x: number) => { $vol = x }} min={0} max={100} step={v.step} format={format} showValue={v.showValue} /></Field>
  }}</div>
}
