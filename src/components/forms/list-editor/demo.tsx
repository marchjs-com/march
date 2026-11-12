// Showcase stage for ListEditor: a cap on the list and the read-only state.
import { ListEditor } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Etiketler" group><ListEditor bind:value={$tags} max={5} placeholder="Etiket ekle" /></Field>`

export default function ListEditorDemo(props: { values: { max: number; readonly: boolean } }) {
  let $tags = ["tasarım", "ürün", "yayın"]
  return <div>{() => <Field label="Etiketler" group help={`En fazla ${props.values.max}; birden çok satır yapıştırmak her satırı ekler.`}>
    <ListEditor value={$tags} onChange={(v: string[]) => { $tags = v }} max={props.values.max} readonly={props.values.readonly} placeholder="Etiket ekle" />
  </Field>}</div>
}
