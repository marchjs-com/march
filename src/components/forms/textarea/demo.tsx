// Showcase stage for Textarea: rows and a live character counter.
import { Textarea } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Hakkında" help={() => \`\${$about.length}/280\`}>
  <Textarea bind:value={$about} rows={3} maxLength={280} />
</Field>`

export default function TextareaDemo(props: { values: { rows: number; counter: boolean } }) {
  let $about = "HADİ ekibinde ürün tasarımı yapıyorum."
  return <div>{() => <Field label="Hakkında" help={props.values.counter ? () => `${$about.length}/280` : undefined}>
    <Textarea value={$about} onChange={(v: string) => { $about = v }} rows={props.values.rows} maxLength={280} placeholder="Kendinden kısaca bahset" />
  </Field>}</div>
}
