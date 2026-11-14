// Showcase stage for Textarea: rows, a live character counter, monospace text and Tab indenting.
import { Textarea } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Hakkında" help={() => \`\${$about.length}/280\`}>
  <Textarea bind:value={$about} rows={3} maxLength={280} />
</Field>
<Textarea bind:value={$json} mono tabIndent rows={6} spellcheck={false} aria-label="JSON" />   // kod alanı: Tab girinti yapar`

export default function TextareaDemo(props: { values: { rows: number; counter: boolean; mono: boolean; tabIndent: boolean } }) {
  let $about = "HADİ ekibinde ürün tasarımı yapıyorum."
  return <div class="sc-stack">{() => {
    const v = { ...props.values }
    const help = v.tabIndent ? "Tab girinti yapar; alandan çıkmak için önce Esc, sonra Tab." : v.counter ? () => `${$about.length}/280` : undefined
    return <Field label="Hakkında" help={help}>
      <Textarea value={$about} onChange={(x: string) => { $about = x }} rows={v.rows} maxLength={280} mono={v.mono} tabIndent={v.tabIndent} placeholder="Kendinden kısaca bahset" />
    </Field>
  }}</div>
}
