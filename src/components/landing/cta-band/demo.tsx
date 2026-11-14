// Showcase stage for CtaBand.
import { CtaBand } from "./index.ts";
import { arrowRight } from "../../../icons/glyphs/arrowRight.ts";
import { appUrl } from "../../../base/index.ts";

export const code = `<CtaBand variant="gradient" title="Bu hafta sonu bir plan yap" lead="…"
  actions={[{ label: "HADİ'ye katıl", href: "/join", iconEnd: arrowRight }, { label: "Etkinliklere göz at" }]} note="Ücretsiz" />`

export default function CtaBandDemo(props: { values: { variant: string; align: string } }) {
  return <div class="sc-site-frame">
    {() => {
      const v = { ...props.values }
      return <CtaBand variant={v.variant as "gradient"} align={v.align as "center"} title="Bu hafta sonu bir plan yap"
        lead="Yakınındaki etkinliklere katıl ya da kendi buluşmanı kur."
        actions={[{ label: "HADİ'ye katıl", iconEnd: arrowRight }, { label: "Etkinliklere göz at" }]} note="Ücretsiz · Premium isteğe bağlı"
        video={{ src: appUrl("media/hadi-waves.webm"), poster: appUrl("media/hadi-waves.jpg") }} />
    }}
  </div>
}
