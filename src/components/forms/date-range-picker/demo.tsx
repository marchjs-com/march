// Showcase stage for DateRangePicker: with presets or only the custom pair.
import { DateRangePicker, type DateRange } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Rapor dönemi" group><DateRangePicker bind:value={$range} /></Field>
<DateRangePicker bind:value={$range} presets={false} />`

export default function DateRangePickerDemo(props: { values: { presets: boolean } }) {
  let $range = null as DateRange | null
  return <div class="sc-stack">
    {() => <Field label="Rapor dönemi" group><DateRangePicker value={$range} onChange={(v: DateRange | null) => { $range = v }} presets={props.values.presets ? undefined : false} /></Field>}
    <p class="hm-muted">{() => `Değer: ${$range ? `${$range.from ?? "…"} → ${$range.to ?? "…"}` : "—"}`}</p>
  </div>
}
