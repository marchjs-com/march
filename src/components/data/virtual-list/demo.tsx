// Showcase stage for VirtualList: thousands of rows of mixed height in a fixed box; a live count shows how few are in
// the DOM while you scroll.
import { VirtualList } from "./index.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { onCleanup } from "../../../core/reactive.ts";

export const code = `<VirtualList items={$rows} key={(r) => r.id} estimate={64}
  render={(r) => <Row row={r()} />}          // r is an accessor: an updated item updates its row
  onEndReached={loadMore} />                  // infinite scroll`

const WORDS = ["Koşu", "Bisiklet", "Kitap", "Kahve", "Yürüyüş", "Fotoğraf", "Masa oyunu", "Konser", "Atölye", "Piknik"]
const LONG = " Uzun açıklamalı satır: yükseklik içeriğe göre ölçülür, tahmin yalnız ölçülene kadar kullanılır."

export default function VirtualListDemo(props: { values: { count: number; heights: string; gap: number; overscan: number } }) {
  let $inDom = 0
  let box!: HTMLElement
  const stop = onFrame(() => { const n = box?.querySelectorAll("[role=listitem]").length ?? 0; if (n !== $inDom) $inDom = n }, { essential: true })
  onCleanup(stop)
  const rows = () => Array.from({ length: props.values.count }, (_, i) => ({ id: i, title: `${WORDS[i % WORDS.length]} buluşması #${i + 1}`, long: props.values.heights === "mixed" && i % 3 === 1 }))
  return <div class="sc-social-vlist-wrap">
    <p class="sc-strip-label" aria-live="off">{() => `${props.values.count.toLocaleString("tr-TR")} satır · DOM'da ${$inDom}`}</p>
    <div class="sc-social-vlist" ref={(x: Element) => { box = x as HTMLElement }}>
      {() => <VirtualList items={rows()} key={(r) => r.id} estimate={56} gap={props.values.gap} overscan={props.values.overscan} label="Buluşmalar"
        render={(r) => <div class={() => `sc-social-vrow sc-social-vrow-c${(r().id % 4) + 1}`}><b>{() => r().title}</b>{() => (r().long ? <span>{LONG}</span> : null)}</div>} />}
    </div>
  </div>
}
