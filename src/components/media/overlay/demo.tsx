// Showcase stage for Overlay: one effect layer in a card, behind or in front of its content (playground.ts).
import { Overlay } from "./index.ts";

export const code = `<div class="card"><Overlay effect="mesh" /><h3>Başlık</h3></div>
<Overlay src="media/hadi-waves.webm" poster="media/hadi-waves.jpg" />   // sessiz, döngülü, görünürken oynar
<Overlay effect="glass" front inset={4} />`

export default function OverlayDemo(props: { values: { effect: string; front: boolean; opacity: number } }) {
  return <div class="sc-col">
    {() => {
      const v = props.values
      return <div class="sc-ov-card">
        <Overlay effect={v.effect as "mesh"} front={v.front} opacity={v.opacity} />
        <strong>Acme Konferansı</strong>
        <p>Katman tıklamaları almaz: bu düğme çalışır.</p>
        <button type="button" class="hm-btn hm-btn-sm">Kayıt ol</button>
      </div>
    }}
  </div>
}
