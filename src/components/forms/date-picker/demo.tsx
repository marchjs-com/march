// Showcase stage for DatePicker: the locale changes the typing order and the placeholder.
import { DatePicker } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Tarih"><DatePicker bind:value={$date} /></Field>
<Field label="Teslim"><DatePicker bind:value={$due} min={todayIso()} locale="en-US" /></Field>`

export default function DatePickerDemo(props: { values: { locale: string; disabled: boolean } }) {
  let $date = "2026-03-14" as string | null
  return <div class="sc-stack">
    {() => <Field label="Tarih"><DatePicker value={$date} onChange={(v: string | null) => { $date = v }} locale={props.values.locale || undefined} disabled={props.values.disabled} /></Field>}
    <p class="hm-muted">{() => `Değer (ISO): ${$date ?? "—"}`}</p>
  </div>
}
