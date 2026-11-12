// Showcase stage for DateTimeInput: the stored value is one UTC timestamp.
import { DateTimeInput } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Başlangıç"><DateTimeInput bind:value={$startsAt} defaultTime="09:00" /></Field>`

export default function DateTimeInputDemo(props: { values: { disabled: boolean } }) {
  let $at = "2026-03-14T09:30:00.000Z" as string | null
  return <div class="sc-stack">
    {() => <Field label="Başlangıç"><DateTimeInput value={$at} onChange={(v: string | null) => { $at = v }} defaultTime="09:00" disabled={props.values.disabled} /></Field>}
    <p class="hm-muted">{() => `Değer (UTC): ${$at ?? "—"}`}</p>
  </div>
}
