// Showcase stage for Empty: icon, text and action follow the Playground values (playground.ts).
import { Empty } from "./index.ts";
import { Button } from "../../../ui/button.ts";
import { inbox } from "../../../icons/glyphs/inbox.ts";
import { plus } from "../../../icons/glyphs/plus.ts";

export const code = `<Empty icon={inbox} title="Gelen kutusu boş" action={[<Button variant="primary" icon={plus}>Yeni mesaj</Button>]}>
  Yeni bir konuşma başlatın ya da bir ekip arkadaşını davet edin.
</Empty>
<Empty size="sm" title="Eşleşme yok" />                      // panel, liste, açılır pencere içi`

export default function EmptyDemo(props: { values: { size: string; icon: boolean; title: boolean; text: boolean; action: boolean } }) {
  let $made = 0
  return <div class="sc-col">
    {() => {
      const v = props.values
      return <Empty size={v.size as "md"} icon={v.icon ? inbox : undefined} title={v.title ? () => ($made ? `${$made} taslak oluşturuldu` : "Gelen kutusu boş") : false}
        action={v.action ? [<Button variant="primary" icon={plus} on:click={() => { $made++ }}>Yeni mesaj</Button>] : undefined}>
        {v.text ? "Yeni bir konuşma başlatın ya da bir ekip arkadaşını davet edin." : null}
      </Empty>
    }}
  </div>
}
