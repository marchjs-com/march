// Showcase stage for DateRangePicker: with presets or only the custom pair.
import { DateRangePicker, type DateRange } from "./index.ts";
import { Field } from "../../../forms/field.ts";
// unions live outside JSX: the March compiler reads `|` in a JSX expression as a pipe
type Maybe<T> = T | null | undefined

export const code = `<Field label="Rapor dönemi" group><DateRangePicker bind:value={$range} /></Field>
<DateRangePicker bind:value={$range} presets={false} />`

const NO_RANGE: Maybe<DateRange> = null

export default function DateRangePickerDemo(props: { values: { presets: boolean } }) {
  let $range = NO_RANGE
  return <div class="sc-stack">
    {() => <Field label="Rapor dönemi" group><DateRangePicker value={$range} onChange={(v: Maybe<DateRange>) => { $range = v }} presets={props.values.presets ? undefined : false} /></Field>}
    <p class="hm-muted">{() => `Değer: ${$range ? `${$range.from ?? "…"} → ${$range.to ?? "…"}` : "—"}`}</p>
  </div>
}
