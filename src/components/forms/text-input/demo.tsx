// Showcase stage for TextInput (and EmailInput / UrlInput): the Playground picks the kind, the prefix and the state.
import { TextInput, EmailInput, UrlInput } from "./index.ts";
import { Field } from "../../../forms/field.ts";
import { Icon, search, globe } from "../../../icons/index.ts";

export const code = `<Field label="Ara"><TextInput bind:value={$q} placeholder="Üye, sipariş, etiket…" prefix={<Icon of={search} />} /></Field>
<Field label="E-posta"><EmailInput bind:value={$mail} /></Field>
<Field label="Web adresi"><UrlInput bind:value={$site} /></Field>`

export default function TextInputDemo(props: { values: { kind: string; prefix: string; disabled: boolean } }) {
  let $text = ""
  return <div class="sc-stack">
    {() => {
      const v = props.values
      const prefix = v.prefix === "icon" ? <Icon of={v.kind === "url" ? globe : search} /> : v.prefix === "text" ? (v.kind === "url" ? "www" : "@") : undefined
      const common = { value: $text, onChange: (x: string) => { $text = x }, prefix, disabled: v.disabled }
      if (v.kind === "email") return <Field label="E-posta"><EmailInput {...common} placeholder="ad@hadisosyal.com" /></Field>
      if (v.kind === "url") return <Field label="Web adresi"><UrlInput {...common} /></Field>
      return <Field label="Ara"><TextInput {...common} placeholder="Üye, sipariş, etiket…" /></Field>
    }}
    <p class="hm-muted">{() => `Değer: ${JSON.stringify($text)}`}</p>
  </div>
}
