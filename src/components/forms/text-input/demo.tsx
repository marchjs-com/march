// Showcase stage for TextInput (and EmailInput / UrlInput): the Playground picks the kind, the prefix and the state.
import { untrack } from "../../../core/reactive.ts";
import { TextInput, EmailInput, UrlInput } from "./index.ts";
import { Field } from "../../../forms/field.ts";
import { Icon, search, globe } from "../../../icons/index.ts";

export const code = `<Field label="Ara"><TextInput bind:value={$q} placeholder="Üye, sipariş, etiket…" prefix={<Icon of={search} />} /></Field>
<Field label="E-posta"><EmailInput bind:value={$mail} /></Field>
<Field label="Web adresi"><UrlInput bind:value={$site} /></Field>
<TextInput bind:value={$email} type="email" aria-label="E-posta" error={$problem} onPaste={(e) => addLines(e)} />   // Field'sız: kendi hata metni`

export default function TextInputDemo(props: { values: { kind: string; prefix: string; disabled: boolean; error: boolean; paste: boolean } }) {
  let $text = ""
  let $pasted = ""
  return <div class="sc-stack">
    {() => {
      const v = props.values
      const prefix = v.prefix === "icon" ? <Icon of={v.kind === "url" ? globe : search} /> : v.prefix === "text" ? (v.kind === "url" ? "www" : "@") : undefined
      // error: the text shows under the input while it is empty; onPaste: the pasted text is caught and shown below
      const error = v.error ? () => ($text ? "" : "Bu alan boş bırakılamaz.") : undefined
      const onPaste = v.paste ? (e: ClipboardEvent) => { e.preventDefault(); $pasted = e.clipboardData?.getData("text") ?? "" } : undefined
      // read once, untracked: a tracked read here would redraw the input (and drop its focus) on every keystroke
      const common = { value: untrack(() => $text), onChange: (x: string) => { $text = x }, prefix, disabled: v.disabled, onPaste, ...(error ? { error } : {}) }
      if (v.kind === "email") return <Field label="E-posta"><EmailInput {...common} placeholder="ad@hadisosyal.com" /></Field>
      if (v.kind === "url") return <Field label="Web adresi"><UrlInput {...common} /></Field>
      return <Field label="Ara"><TextInput {...common} placeholder="Üye, sipariş, etiket…" /></Field>
    }}
    <p class="m-muted">{() => `Değer: ${JSON.stringify($text)}`}</p>
    {() => (props.values.paste ? <p class="sc-demo-call">{`onPaste → ${$pasted ? JSON.stringify($pasted) : "bir metin yapıştır: girdiye yazılmaz, burada görünür"}`}</p> : null)}
  </div>
}
