// Showcase stage for Select.
import { Select } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Şehir"><Select bind:value={$city} options={cities} placeholder="Seç…" /></Field>`

const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Konya", "Trabzon"].map((c) => ({ value: c, label: c }))

export default function SelectDemo(props: { values: { disabled: boolean } }) {
  let $city = "İzmir"
  return <div class="sc-stack">
    {() => <Field label="Şehir"><Select value={$city} onChange={(v: string | null) => { $city = v ?? "" }} options={CITIES} placeholder="Seç…" disabled={props.values.disabled} /></Field>}
    <p class="hm-muted">{() => `Seçilen: ${$city || "—"}`}</p>
  </div>
}
