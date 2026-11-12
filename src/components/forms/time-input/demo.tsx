// Showcase stage for TimeInput: with or without seconds.
import { TimeInput } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Başlangıç"><TimeInput bind:value={$start} min="09:00" max="18:00" /></Field>`

export default function TimeInputDemo(props: { values: { seconds: boolean; disabled: boolean } }) {
  let $time = "09:30"
  return <div class="sc-stack">
    {() => <Field label="Başlangıç"><TimeInput value={$time} onChange={(v: string) => { $time = v }} step={props.values.seconds ? 1 : undefined} disabled={props.values.disabled} /></Field>}
    <p class="hm-muted">{() => `Değer: ${$time || "—"}`}</p>
  </div>
}
