// Showcase stage for Overlay: one effect layer in a card, behind or in front of its content (playground.ts).
import { Overlay } from "./index.ts";
import { Button } from "../../actions/button/index.ts";

export const code = `<div class="card"><Overlay effect="mesh" /><h3>Başlık</h3></div>
<Overlay src="media/hadi-waves.webm" poster="media/hadi-waves.jpg" />   // sessiz, döngülü, görünürken oynar
<Overlay effect="glass" front inset={4} />
<Overlay effect="spotlight" m:color="brand-orange" />               // spotlight, dots, grid, vignette take a theme colour`

export default function OverlayDemo(props: { values: { effect: string; color: string; front: boolean; opacity: number } }) {
  return <div class="sc-col">
    {() => {
      const v = props.values
      return <div class="sc-ov-card">
        <Overlay effect={v.effect as "mesh"} m:color={v.color === "theme" ? undefined : (v.color as "brand-orange")} front={v.front} opacity={v.opacity} />
        <strong>HADİ Konferansı</strong>
        <p>Katman tıklamaları almaz: bu düğme çalışır.</p>
        <Button size="sm">Kayıt ol</Button>
      </div>
    }}
  </div>
}
