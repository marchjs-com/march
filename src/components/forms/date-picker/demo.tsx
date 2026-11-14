// Showcase stage for DatePicker: the locale changes the typing order and the placeholder.
import { DatePicker } from "./index.ts";
import { Field } from "../../../forms/field.ts";
import { Icon } from "../../../icons/index.ts";
import { clock } from "../../../icons/glyphs/clock.ts";
// unions live outside JSX: the March compiler reads `|` in a JSX expression as a pipe
type Maybe<T> = T | null | undefined
/** An empty choice means "not set". */
const pick = (v: string): string | undefined => v || undefined

export const code = `<Field label="Tarih"><DatePicker bind:value={$date} /></Field>
<Field label="Teslim"><DatePicker bind:value={$due} min={todayIso()} locale="en-US" /></Field>
<DatePicker bind:value={$date} icon={() => <Icon of={clock} />} labels={{ choose: "Gün seç" }} calendar={{ weekdays: false }} />   // icon={false}: no button`

const START_DATE: Maybe<string> = "2026-03-14"

export default function DatePickerDemo(props: { values: { locale: string; disabled: boolean; icon: string } }) {
  let $date = START_DATE
  return <div class="sc-stack">
    {() => <Field label="Tarih"><DatePicker value={$date} onChange={(v: Maybe<string>) => { $date = v }} locale={pick(props.values.locale)} disabled={props.values.disabled}
      icon={props.values.icon === "off" ? false : props.values.icon === "own" ? () => <Icon of={clock} /> : undefined} labels={{ choose: "Gün seç", prevMonth: "Önceki ay", nextMonth: "Sonraki ay" }} /></Field>}
    <p class="hm-muted">{() => `Değer (ISO): ${$date ?? "—"}`}</p>
  </div>
}
