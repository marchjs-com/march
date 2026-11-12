// Showcase stage for Button: variant, size, icon, loading, disabled and block follow the Playground values; the second
// row is an ActionButton (an action() with confirm and toasts).
import { Button, ActionButton } from "./index.ts";
import { action } from "../../../ui/action.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import { arrowRight } from "../../../icons/glyphs/arrowRight.ts";

export const code = `<Button variant="primary" icon={plus}>Yeni proje</Button>
<Button size="sm" loading={$saving} on:click={save}>Kaydet</Button>
<Button href="/docs" iconEnd={arrowRight}>Belgeler</Button>    // a router link
const remove = action("Sil", api.remove, { icon: trash, danger: true, confirm: "Silinsin mi?", success: "Silindi" })
<ActionButton action={remove} args={[row]} />                  // hidden / disabled / busy from the action`

export default function ButtonDemo(props: { values: { variant: string; size: string; icon: boolean; loading: boolean; disabled: boolean; block: boolean } }) {
  let $clicks = 0
  const remove = action("Taslağı sil", async () => { await new Promise((r) => setTimeout(r, 600)) }, { icon: trash, danger: true, confirm: "Taslak silinsin mi?", success: "Taslak silindi" })
  return <div class="sc-col">
    {() => {
      const v = props.values
      return <div class="sc-row">
        <Button variant={v.variant as "primary"} size={v.size as "md"} icon={v.icon ? plus : undefined} loading={v.loading} disabled={v.disabled} block={v.block}
          on:click={() => { $clicks++ }}>{() => ($clicks ? `Yeni proje (${$clicks})` : "Yeni proje")}</Button>
        {v.block ? null : <Button variant="ghost" size={v.size as "md"} iconEnd={arrowRight}>Devam</Button>}
      </div>
    }}
    <div class="sc-row"><ActionButton action={remove} size="sm" /></div>
  </div>
}
