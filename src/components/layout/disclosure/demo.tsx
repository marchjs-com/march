// Showcase stage for Disclosure: two sections, one open (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { Disclosure } from "./index.ts";

export const code = `<Disclosure title="Gelişmiş ayarlar" open={$open} onToggle={(o) => $open = o}>…</Disclosure>`

export default function DisclosureDemo(props: { values: { open: boolean } }) {
  const last = signal("—")
  return <div class="sc-disc-demo">
    {() => { const open = props.values.open; return <Disclosure title="Gelişmiş ayarlar" open={open} onToggle={(o: boolean) => last.set(o ? "açıldı" : "kapandı")}>
      <p>Önbellek süresi 10 dakika; günlük kayıtları 30 gün saklanır.</p>
    </Disclosure> }}
    <Disclosure title="Sık sorulan: verilerim nerede tutulur?">
      <p>Avrupa'daki veri merkezlerinde, şifreli olarak.</p>
    </Disclosure>
    <p class="hm-muted">{() => `Son değişiklik: ${last()}`}</p>
  </div>
}
