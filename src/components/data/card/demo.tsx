// Showcase stage for Card: header, actions, footer and flush body follow the Playground values (playground.ts).
import { Card } from "./index.ts";
import { Button } from "../../../ui/button.ts";
import { KeyValue } from "../key-value/index.ts";
import { edit } from "../../../icons/glyphs/edit.ts";

export const code = `<Card title="Acme Ltd." subtitle="Kurumsal plan" actions={[<Button size="sm" icon={edit}>Düzenle</Button>]}
  footer={<span class="hm-muted">Son güncelleme: bugün</span>}>
  …
</Card>
<Card flush>…</Card>                                   // body without padding (tables, lists)`

export default function CardDemo(props: { values: { head: boolean; actions: boolean; footer: boolean; flush: boolean } }) {
  let $edits = 0
  return <div class="sc-col">
    {() => {
      const v = props.values
      return <Card title={v.head ? "Acme Ltd." : undefined} subtitle={v.head ? "Kurumsal plan" : undefined}
        actions={v.head && v.actions ? [<Button size="sm" icon={edit} on:click={() => { $edits++ }}>Düzenle</Button>] : undefined}
        footer={v.footer ? <span class="hm-muted">{() => ($edits ? `${$edits} düzenleme yapıldı` : "Son güncelleme: bugün")}</span> : undefined} flush={v.flush}>
        <KeyValue columns={2} items={[{ label: "Kullanıcı", value: "48" }, { label: "Depolama", value: "12,4 GB" }]} />
      </Card>
    }}
  </div>
}
