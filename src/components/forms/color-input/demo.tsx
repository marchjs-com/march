// Showcase stage for ColorInput: start from one of the HADİ colors.
import { ColorInput } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Marka rengi"><ColorInput bind:value={$color} /></Field>`

export default function ColorInputDemo(props: { values: { start: string } }) {
  return <div>{() => {
    let $color = props.values.start
    return <Field label="Marka rengi"><ColorInput bind:value={$color} /></Field>
  }}</div>
}
