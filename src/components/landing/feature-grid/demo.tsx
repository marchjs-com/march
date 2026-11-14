// Showcase stage for FeatureGrid: six features (bento gets sizes and small media) for the Playground values.
import { FeatureGrid, type FeatureItem } from "./index.ts";
import { MockApp } from "../demo-kit.tsx";
import { Counter } from "../counter/index.ts";
import { mapPin } from "../../../icons/glyphs/mapPin.ts";
import { users } from "../../../icons/glyphs/users.ts";
import { message } from "../../../icons/glyphs/message.ts";
import { video } from "../../../icons/glyphs/video.ts";
import { ticket } from "../../../icons/glyphs/ticket.ts";
import { heart } from "../../../icons/glyphs/heart.ts";

export const code = `<FeatureGrid variant="bento" items={[
  { icon: mapPin, title: "Yakınındaki etkinlikler", body: "…", span: "big", media: <Screenshot /> },
  { icon: users, title: "Tanışma yemekleri", body: "…" },
  { icon: ticket, title: "Bilet sat", body: "…", span: "wide" },
]} />
<FeatureGrid variant="cards" cols={3} items={features} />`

export const FEATURES: FeatureItem[] = [
  { icon: mapPin, title: "Yakınındaki etkinlikler", body: "Bugün, bu hafta sonu ya da gelecek ay: ilgi alanına göre, haritada ve takvimde." },
  { icon: users, title: "Tanışma yemekleri", body: "Birkaç kişilik masalar; ortak ilgi alanı olanlarla aynı sofrada." },
  { icon: message, title: "Sohbet ve gruplar", body: "Birebir, grup ve etkinlik sohbetleri; buluşmadan önce de sonra da." },
  { icon: ticket, title: "Bilet sat", body: "Etkinliğini kur, kontenjanı belirle, bileti HADİ'den sat." },
  { icon: video, title: "Görüntülü görüşme", body: "Uzaktaki arkadaşınla ya da etkinlik öncesi tanışmak için." },
  { icon: heart, title: "Akış ve hikâyeler", body: "Etkinlik anılarını paylaş, beğen, keşfet." },
]

export default function FeatureGridDemo(props: { values: { variant: string; cols: number; spotlight: boolean } }) {
  return <div>
    {() => {
      const v = { ...props.values }
      const items = v.variant === "bento"
        ? FEATURES.map((f, i) => ({ ...f, span: (["big", "normal", "normal", "wide", "normal", "normal"] as const)[i], media: i === 0 ? <MockApp class="sc-mock-sm" /> : i === 3 ? <div class="sc-bento-stat"><Counter value={1200} suffix="+" /><span>etkinlik her hafta</span></div> : undefined }))
        : FEATURES
      return <FeatureGrid variant={v.variant as "cards"} cols={v.cols as 3} spotlight={v.spotlight} items={items} />
    }}
  </div>
}
