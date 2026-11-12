// Showcase stage for Drawer: a button opens it with the Playground values (playground.ts).
import { Drawer } from "./index.ts";
import { Button } from "../../../ui/button.ts";

export const code = `<Drawer open={$open} onClose={() => $open = false} side="bottom" snapPoints={[0.4, 0.9]} title="Filtreler">…</Drawer>
<Drawer open={$menu} onClose={() => $menu = false} side="start" size="sm" title="Menü">…</Drawer>     // RTL'de sağdan
<Drawer open={$panel} onClose={() => $panel = false} side="end" modal={false} title="Ayrıntı">…</Drawer>`

const SNAPS: Record<string, number[] | undefined> = { none: undefined, two: [0.4, 0.9], three: [0.25, 0.55, 0.9] }

export default function DrawerDemo(props: { values: { side: string; modal: boolean; snap: string; size: string; dragToClose: boolean; content: string } }) {
  let $open = false
  let $snap = 0
  return <div class="sc-row">
    <Button variant="primary" data-audit-try="toggle" on:click={() => { $open = !$open }}>{() => ($open ? "Çekmeceyi kapat" : "Çekmeceyi aç")}</Button>
    <span class="sc-strip-label" aria-live="polite">{() => (SNAPS[props.values.snap] && $open ? `Durma noktası: ${$snap + 1}` : "")}</span>
    {() => {
      const v = props.values
      const snaps = SNAPS[v.snap]
      // short: the sheet is as tall as its content (snap points above it are cut down); long: the body scrolls
      const rows = Array.from({ length: v.content === "short" ? 3 : 40 }, (_, i) => `Satır ${i + 1}`)
      return <Drawer open={() => $open} onClose={() => { $open = false }} side={v.side as "bottom"} modal={v.modal} dragToClose={v.dragToClose}
        snapPoints={snaps} size={v.size as "md"} onSnap={(i) => { $snap = i }} title="Çekmece">
        <p>{snaps ? "Tutamaçtan ya da başlıktan sürükleyin; bırakınca en yakın durma noktasına oturur" : "Tutamaçtan ya da başlıktan sürükleyebilirsiniz"}{v.dragToClose ? ", kenara atınca kapanır." : "; sürükleyerek kapanmaz, kapatmak için düğmeyi ya da Escape tuşunu kullanın."}</p>
        <ul>{rows.map((r) => <li>{r}</li>)}</ul>
      </Drawer>
    }}
  </div>
}
