// Showcase stage for MultiSelect.
import { MultiSelect } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Diller"><MultiSelect bind:value={$langs} options={languages} /></Field>`

const LANGS = [{ value: "tr", label: "Türkçe" }, { value: "en", label: "İngilizce" }, { value: "de", label: "Almanca" }, { value: "ar", label: "Arapça" }, { value: "fr", label: "Fransızca" }, { value: "es", label: "İspanyolca" }]

export default function MultiSelectDemo(props: { values: { readonly: boolean } }) {
  let $langs = ["tr", "en"]
  return <div class="sc-stack">
    {() => <Field label="Diller"><MultiSelect value={$langs} onChange={(v: unknown) => { $langs = v as string[] }} options={LANGS} readonly={props.values.readonly} placeholder="Dil ekle" /></Field>}
    <p class="hm-muted">{() => `Değer: [${$langs.join(", ")}]`}</p>
  </div>
}
