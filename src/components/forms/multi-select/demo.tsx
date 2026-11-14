// Showcase stage for MultiSelect.
import { MultiSelect } from "./index.ts";
import { Field } from "../../../forms/field.ts";
import { Icon } from "../../../icons/index.ts";
import { trash } from "../../../icons/glyphs/trash.ts";

export const code = `<Field label="Diller"><MultiSelect bind:value={$langs} options={languages} /></Field>
<MultiSelect bind:value={$langs} options={languages} removeIcon={() => <Icon of={trash} />}
  labels={{ noResults: "Sonuç yok", remove: (l) => \`\${l} dilini kaldır\` }} />`

const LANGS = [{ value: "tr", label: "Türkçe" }, { value: "en", label: "İngilizce" }, { value: "de", label: "Almanca" }, { value: "ar", label: "Arapça" }, { value: "fr", label: "Fransızca" }, { value: "es", label: "İspanyolca" }]

export default function MultiSelectDemo(props: { values: { readonly: boolean; remove: string } }) {
  let $langs = ["tr", "en"]
  return <div class="sc-stack">
    {() => <Field label="Diller"><MultiSelect value={$langs} onChange={(v: unknown) => { $langs = v as string[] }} options={LANGS} readonly={props.values.readonly} placeholder="Dil ekle"
      removeIcon={props.values.remove === "off" ? false : props.values.remove === "icon" ? () => <Icon of={trash} /> : undefined} labels={{ noResults: "Sonuç yok", remove: (l: string) => `${l} dilini kaldır` }} /></Field>}
    <p class="m-muted">{() => `Değer: [${$langs.join(", ")}]`}</p>
  </div>
}
