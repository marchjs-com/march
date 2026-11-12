// Showcase stage for Loader: inline, or over a card's content (overlay) until "Bitir".
import { Loader } from "./index.ts";
import { Button } from "../../../ui/button.ts";

export const code = `<Loader text="Panolar hazırlanıyor…" />
<div class="relative">{content}{() => busy() && <Loader overlay />}</div>
bootLoader.done()                            // index.html'deki #hm-boot ekranını kaldırır`

export default function LoaderDemo(props: { values: { text: boolean; overlay: boolean } }) {
  let $busy = true
  return <div class="sc-col">
    <div class="sc-row"><Button size="sm" on:click={() => { $busy = !$busy }}>{() => ($busy ? "Bitir" : "Yeniden yükle")}</Button></div>
    {() => {
      const v = props.values
      const text = v.text ? "Panolar hazırlanıyor…" : undefined
      if (!v.overlay) return $busy ? <Loader text={text} /> : <p class="sc-loader-done">Panolar hazır.</p>
      return <div class="sc-loader-box">
        <strong>Acme satış panosu</strong>
        <p class="hm-muted">Bu çeyrekte 1.284 sipariş, ortalama sepet 412 ₺.</p>
        {$busy ? <Loader overlay text={text} /> : null}
      </div>
    }}
  </div>
}
