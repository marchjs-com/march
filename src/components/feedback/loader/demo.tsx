// Showcase stage for Loader: inline, or over a card's content (overlay) until "Bitir".
import { Loader } from "./index.ts";
import { Button } from "../../../ui/button.ts";
import { Icon } from "../../../icons/index.ts";
import { hourglass } from "../../../icons/glyphs/hourglass.ts";

export const code = `<Loader text="Panolar hazırlanıyor…" />
<div class="relative">{content}{() => busy() && <Loader overlay />}</div>
<Loader color="brand-orange" />  <Loader spinner={<Icon of={hourglass} />} label="Açılıyor" />  <Loader spinner={false} text="Bir saniye…" />
bootLoader.done()                            // index.html'deki #m-boot ekranını kaldırır`

export default function LoaderDemo(props: { values: { text: boolean; overlay: boolean; spinner: string; color: string } }) {
  let $busy = true
  return <div class="sc-col">
    <div class="sc-row"><Button size="sm" on:click={() => { $busy = !$busy }}>{() => ($busy ? "Bitir" : "Yeniden yükle")}</Button></div>
    {() => {
      const v = props.values
      const text = v.text ? "Panolar hazırlanıyor…" : undefined
      const part = () => ({
        spinner: v.spinner === "off" ? false : v.spinner === "own" ? <Icon of={hourglass} size="xl" /> as Node : true,
        color: v.color === "theme" || v.spinner !== "on" ? undefined : (v.color as "success"),
      })
      if (!v.overlay) return $busy ? <Loader text={text} {...part()} /> : <p class="sc-loader-done">Panolar hazır.</p>
      return <div class="sc-loader-box">
        <strong>HADİ satış panosu</strong>
        <p class="m-muted">Bu çeyrekte 1.284 sipariş, ortalama sepet 412 ₺.</p>
        {$busy ? <Loader overlay text={text} {...part()} /> : null}
      </div>
    }}
  </div>
}
