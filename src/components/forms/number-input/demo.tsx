// Showcase stage for the NumberInput family: switch the kind, the currency and the decimals.
import { NumberInput, IntInput, MoneyInput, PercentInput } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Adet"><NumberInput bind:value={$n} min={0} max={99} /></Field>
<Field label="Fiyat"><MoneyInput bind:value={$price} currency="TRY" /></Field>
<Field label="İndirim"><PercentInput bind:value={$rate} /></Field>   // 0.125 → 12,5 %`

export default function NumberInputDemo(props: { values: { kind: string; currency: string; decimals: number } }) {
  let $n = 1499.9
  let $rate = 0.125
  return <div class="sc-stack">
    {() => {
      const v = props.values
      if (v.kind === "money") return <Field label="Fiyat"><MoneyInput value={$n} onChange={(x: number | null) => { $n = x ?? 0 }} currency={v.currency} /></Field>
      if (v.kind === "percent") return <Field label="İndirim"><PercentInput value={$rate} onChange={(x: number | null) => { $rate = x ?? 0 }} /></Field>
      if (v.kind === "int") return <Field label="Adet"><IntInput value={$n} onChange={(x: number | null) => { $n = x ?? 0 }} min={0} /></Field>
      return <Field label="Miktar"><NumberInput value={$n} onChange={(x: number | null) => { $n = x ?? 0 }} decimals={v.decimals} minDecimals={v.decimals} grouping /></Field>
    }}
    <p class="hm-muted">{() => `Saklanan değer: ${props.values.kind === "percent" ? $rate : $n}`}</p>
  </div>
}
