// Showcase stage for ColorInput: start from one of the HADİ colors.
import { ColorInput } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Marka rengi"><ColorInput bind:value={$color} /></Field>
<ColorInput bind:value={$color} text={false} swatchLabel="Marka rengi" />   // only the swatch; swatch={false}: only the text`

export default function ColorInputDemo(props: { values: { start: string; parts: string } }) {
  return <div>{() => {
    let $color = props.values.start
    const parts = props.values.parts
    return <Field label="Marka rengi"><ColorInput bind:value={$color} swatch={parts !== "text"} text={parts !== "swatch"} swatchLabel="Renk seç" /></Field>
  }}</div>
}
