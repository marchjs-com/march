// Showcase stage for Combobox: a static list or an async search.
import { Combobox } from "./index.ts";
import { Field } from "../../../forms/field.ts";

export const code = `<Field label="İlçe"><Combobox bind:value={$town} options={towns} placeholder="Yazmaya başla" /></Field>
<Field label="Üye"><Combobox bind:value={$member} search={(q) => api.members(q)} /></Field>`

const TOWNS = ["Kadıköy", "Beşiktaş", "Üsküdar", "Şişli", "Bakırköy", "Ataşehir", "Sarıyer", "Fatih", "Beyoğlu", "Maltepe"].map((x) => ({ value: x, label: x }))
const MEMBERS = ["HADİ Tasarım", "HADİ Lojistik", "Atlas Yazılım", "Bora Gıda", "Deniz Medya", "Ege Enerji", "Kuzey Mimarlık"].map((x, i) => ({ value: i + 1, label: x, hint: `#${100 + i}` }))
const search = (q: string) => new Promise<typeof MEMBERS>((r) => setTimeout(() => r(MEMBERS.filter((m) => m.label.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")))), 300))

export default function ComboboxDemo(props: { values: { source: string; disabled: boolean } }) {
  let $pick = null as unknown
  return <div class="sc-stack">
    {() => props.values.source === "async"
      ? <Field label="Üye (sunucudan arar)"><Combobox value={$pick} onChange={(v: unknown) => { $pick = v }} search={search} debounce={200} placeholder="En az bir harf yaz" disabled={props.values.disabled} /></Field>
      : <Field label="İlçe"><Combobox value={$pick} onChange={(v: unknown) => { $pick = v }} options={TOWNS} placeholder="Yazmaya başla" disabled={props.values.disabled} /></Field>}
    <p class="m-muted">{() => `Değer: ${$pick ?? "—"}`}</p>
  </div>
}
