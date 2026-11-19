// Showcase stage for MultiSelect.
import { MultiSelect } from "./index.ts";
import { Field } from "../../../forms/field.ts";
import { Icon } from "../../../icons/index.ts";
import { trash } from "../../../icons/glyphs/trash.ts";

export const code = `<Field label="Diller"><MultiSelect bind:value={$langs} options={languages} /></Field>
<MultiSelect bind:value={$langs} options={languages} removeIcon={() => <Icon of={trash} />}
  labels={{ noResults: "Sonuç yok", remove: (l) => \`\${l} dilini kaldır\` }} />`


export default function MultiSelectDemo(props: { values: { options: string; readonly: boolean; remove: string } }) {
  let $langs = ["Türkçe", "İngilizce"]
  return <div class="sc-stack">
    {() => <Field label="Diller"><MultiSelect value={$langs} onChange={(v: unknown) => { $langs = v as string[] }} options={props.values.options} readonly={props.values.readonly} placeholder="Dil ekle"
      removeIcon={props.values.remove === "off" ? false : props.values.remove === "icon" ? () => <Icon of={trash} /> : undefined} labels={{ noResults: "Sonuç yok", remove: (l: string) => `${l} dilini kaldır` }} /></Field>}
    <p class="m-muted">{() => `Değer: [${$langs.join(", ")}]`}</p>
  </div>
}
