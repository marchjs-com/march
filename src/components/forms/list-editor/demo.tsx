// Showcase stage for ListEditor: a cap on the list and the read-only state.
import { ListEditor } from "./index.ts";
import { Field } from "../../../forms/field.ts";
import { Icon } from "../../../icons/index.ts";
import { trash } from "../../../icons/glyphs/trash.ts";

export const code = `<Field label="Etiketler" group><ListEditor bind:value={$tags} max={5} placeholder="Etiket ekle" /></Field>
<ListEditor bind:value={$tags} sortable={false} icons={{ remove: () => <Icon of={trash} /> }}
  labels={{ item: (n) => \`\${n}. etiket\`, remove: "Kaldır" }} addLabel="Ekle" />`

export default function ListEditorDemo(props: { values: { max: number; readonly: boolean; sortable: boolean; trash: boolean } }) {
  let $tags = ["tasarım", "ürün", "yayın"]
  return <div>{() => <Field label="Etiketler" group help={`En fazla ${props.values.max}; birden çok satır yapıştırmak her satırı ekler.`}>
    <ListEditor value={$tags} onChange={(v: string[]) => { $tags = v }} max={props.values.max} readonly={props.values.readonly} placeholder="Etiket ekle" addLabel="Ekle"
      sortable={props.values.sortable} icons={props.values.trash ? { remove: () => <Icon of={trash} /> } : undefined}
      labels={{ item: (n: number) => `${n}. etiket`, moveUp: "Yukarı taşı", moveDown: "Aşağı taşı", remove: "Kaldır" }} />
  </Field>}</div>
}
