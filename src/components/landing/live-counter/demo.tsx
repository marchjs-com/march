// Showcase stage for LiveCounter: sample HADİ numbers that grow while you watch (simulated with a rate per minute).
import { LiveCounter } from "./index.ts";

export const code = `<LiveCounter value={$online} label="kişi şu an HADİ'de" />          // fed by your server
<LiveCounter from={18420} rate={40} label="kişi bu hafta bir etkinliğe katıldı" />  // simulated growth`

export default function LiveCounterDemo(props: { values: { rate: number; dot: boolean } }) {
  return <div class="sc-lc-stage">
    {() => {
      const v = { ...props.values }
      return <>
        <LiveCounter from={18420} rate={v.rate} dot={v.dot} label="kişi bu hafta bir etkinliğe katıldı" />
        <LiveCounter from={1264} rate={v.rate / 4} dot={v.dot} label="etkinlik şu an devam ediyor" />
      </>
    }}
  </div>
}
