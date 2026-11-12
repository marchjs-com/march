// Showcase stage for Checkbox: look, size and the indeterminate state.
import { Checkbox } from "./index.ts";
import { users } from "../../../icons/index.ts";

export const code = `<Checkbox bind:value={$agree} label="Kullanım koşullarını okudum" />
<Checkbox value={true} indeterminate label="Bazı alt öğeler seçili" />
<Checkbox variant="card" label="Ekip planı" hint="10 kişiye kadar" icon={users} />`

export default function CheckboxDemo(props: { values: { variant: string; size: string; indeterminate: boolean } }) {
  let $agree = true
  return <div class="sc-stack">{() => {
    const v = props.values
    return <Checkbox value={$agree} onChange={(x: boolean) => { $agree = x }} variant={v.variant as "classic"} size={v.size as "md"} indeterminate={v.indeterminate}
      label={v.variant === "card" ? "Ekip planı" : "Bildirimleri al"} hint={v.variant === "card" ? "10 kişiye kadar, paylaşılan alanlar" : undefined} icon={v.variant === "card" ? users : undefined} />
  }}</div>
}
