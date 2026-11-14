// Showcase stage for PasswordInput.
import { PasswordInput } from "./index.ts";
import { Field } from "../../../forms/field.ts";
import { Icon } from "../../../icons/index.ts";
import { eye } from "../../../icons/glyphs/eye.ts";
import { eyeOff } from "../../../icons/glyphs/eyeOff.ts";
import { computed, untrack } from "../../../core/reactive.ts";

export const code = `<Field label="Parola" help="Güçlü bir parola seç"><PasswordInput bind:value={$pw} autocomplete="new-password" /></Field>
<PasswordInput bind:value={$pw} toggle={(shown) => <Icon of={shown ? eyeOff : eye} />} />   // an icon; toggle={false}: no button
<PasswordInput bind:value={$pw} labels={{ show: "Göster", hide: "Gizle" }} />`

export default function PasswordInputDemo(props: { values: { disabled: boolean; toggle: string } }) {
  let $pw = "hadi-2026"
  // the button is built once: the input is built again only for another kind of button (the text is kept in $pw)
  const kind = computed(() => props.values.toggle)
  return <div>{() => {
    const toggle = kind()
    return untrack(() => <Field label="Parola" help="Göster düğmesiyle yazdığını kontrol et">
      <PasswordInput value={$pw} onChange={(v: string) => { $pw = v }} disabled={props.values.disabled} autocomplete="new-password" labels={{ show: "Göster", hide: "Gizle", showPassword: "Parolayı göster", hidePassword: "Parolayı gizle" }}
        toggle={toggle === "off" ? false : toggle === "icon" ? (shown: boolean) => <Icon of={shown ? eyeOff : eye} /> : true} />
    </Field>)
  }}</div>
}
