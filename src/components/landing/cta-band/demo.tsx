// Showcase stage for CtaBand.
import { CtaBand } from "./index.ts";
import { arrowRight } from "../../../icons/glyphs/arrowRight.ts";
import { appUrl } from "../../../base/index.ts";

export const code = `<CtaBand variant="gradient" title="Bugün başla" lead="…"
  actions={[{ label: "Ücretsiz dene", href: "/start", iconEnd: arrowRight }, { label: "Satışla görüş" }]} note="14 gün ücretsiz" />`

export default function CtaBandDemo(props: { values: { variant: string; align: string } }) {
  return <div class="sc-site-frame">
    {() => {
      const v = props.values
      return <CtaBand variant={v.variant as "gradient"} align={v.align as "center"} title="Sitenizi bu hafta yayına alın"
        lead="Hazır bloklar ve akıcı hareketlerle ilk sürüm saatler içinde hazır."
        actions={[{ label: "Ücretsiz dene", iconEnd: arrowRight }, { label: "Satışla görüş" }]} note="14 gün ücretsiz · istediğin an iptal"
        video={{ src: appUrl("media/hadi-waves.webm"), poster: appUrl("media/hadi-waves.jpg") }} />
    }}
  </div>
}
