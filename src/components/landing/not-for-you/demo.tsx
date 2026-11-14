// Showcase stage for NotForYou: who HADİ is not for (and who it is for); mark the lines that apply.
import { NotForYou, type NotForYouItem } from "./index.ts";

export const code = `<NotForYou check items={[{ text: "Büyük bir konferans düzenliyorsun", detail: "…" }]}
  forYou={[{ text: "Hafta sonu için plan arıyorsun" }]} />`

export const NOT_FOR_YOU: NotForYouItem[] = [
  { text: "Bin kişilik bir konferans düzenliyorsun", detail: "Salon, sponsor ve kayıt masası yönetimi için bir etkinlik platformu daha uygun." },
  { text: "Yalnız iş bağlantısı arıyorsun", detail: "HADİ ortak ilgi alanlarıyla tanışmak için; profesyonel ağ kurmak için başka uygulamalar daha uygun." },
  { text: "Evden hiç çıkmak istemiyorsun", detail: "Görüntülü görüşme var, ama HADİ'nin asıl amacı insanları gerçek hayatta bir araya getirmek." },
  { text: "Yalnız içerik izlemek istiyorsun", detail: "Keşfet akışı ve beğeniler var, ama HADİ'de akış bir etkinliğe katılmanın yolu, amacı değil." },
]
export const FOR_YOU: NotForYouItem[] = [
  { text: "Hafta sonu için plan arıyorsun", detail: "Yakınındaki etkinlikleri önceden gör, yerini ayır." },
  { text: "Yeni bir şehre taşındın", detail: "Ortak ilgi alanları olan insanlarla tanış." },
  { text: "Kendi buluşmanı kurmak istiyorsun", detail: "Ne, nerede, ne zaman: birkaç adımda." },
]

export default function NotForYouDemo(props: { values: { variant: string; check: boolean; both: boolean } }) {
  return <div>
    {() => { const v = { ...props.values }; return <NotForYou variant={v.variant as "cards" | "list"} check={v.check} items={NOT_FOR_YOU} forYou={v.both ? FOR_YOU : undefined} /> }}
  </div>
}
