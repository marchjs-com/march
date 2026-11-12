// Showcase stage for PasswordInput.
import { PasswordInput } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="Parola" help="Güçlü bir parola seç"><PasswordInput bind:value={$pw} autocomplete="new-password" /></Field>`

export default function PasswordInputDemo(props: { values: { disabled: boolean } }) {
  let $pw = "acme-2026"
  return <div>{() => <Field label="Parola" help="Göster düğmesiyle yazdığını kontrol et">
    <PasswordInput value={$pw} onChange={(v: string) => { $pw = v }} disabled={props.values.disabled} autocomplete="new-password" />
  </Field>}</div>
}
