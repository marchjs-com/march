// Showcase stage for Window: a small desk with two windows. Drag a title bar, drop it on an edge to dock, double
// click to fill, drag an edge to resize; the buttons minimize, fill / restore and close.
import { signal } from "../../../core/reactive.ts";
import { Window } from "./index.ts";

export const code = `<div class="desk">                               // the area: any positioned box
  <Window title="Notlar" chrome="mac" persist="notes">…</Window>
  <Window title="Sipariş #2041" chrome="windows" x={320} y={40} width={300} height={200}>…</Window>
</div>`

export default function WindowDemo(props: { values: { chrome: string; snap: boolean; resizable: boolean } }) {
  const notes = signal(true), order = signal(true)
  const chrome = (): "hadi" | "mac" | "windows" => props.values.chrome as "hadi"
  return <div class="sc-win-desk">
    <Window title="Notlar" chrome={chrome} snap={props.values.snap} resizable={props.values.resizable} x={24} y={24} width={330} height={210}
      open={() => notes()} onClose={() => notes.set(false)}>
      <div class="sc-win-pad"><strong>Bugün</strong><ul><li>HADİ vitrinini gözden geçir</li><li>Pencereyi kenara sürükle: yarısına yerleşir</li><li>Başlığa çift tıkla: alanı kaplar</li></ul></div>
    </Window>
    <Window title="Sipariş #2041" chrome={chrome} snap={props.values.snap} resizable={props.values.resizable} x={300} y={110} width={300} height={190}
      open={() => order()} onClose={() => order.set(false)}>
      <div class="sc-win-pad"><p>HADİ Kahve · 2 ürün</p><p class="hm-muted">Kargoya hazırlanıyor</p></div>
    </Window>
    {() => (notes() && order() ? null : <button type="button" class="hm-btn hm-btn-sm sc-win-reopen" onClick={() => { notes.set(true); order.set(true) }}>Pencereleri yeniden aç</button>)}
  </div>
}
