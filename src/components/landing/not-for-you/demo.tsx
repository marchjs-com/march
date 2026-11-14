// Showcase stage for NotForYou: who HADİ is not for (and who it is for); mark the lines that apply.
import { NotForYou, type NotForYouItem } from "./index.ts";

export const code = `<NotForYou check items={[{ text: "Büyük bir konferans düzenliyorsun", detail: "…" }]}
  forYou={[{ text: "Bu akşam bir şey yapmak istiyorsun" }]} />`

export const NOT_FOR_YOU: NotForYouItem[] = [
  { text: "Bin kişilik bir konferans düzenliyorsun", detail: "Bilet, salon ve sponsor yönetimi yok. Bunun için bir etkinlik platformu daha iyi." },
  { text: "Takipçi toplamak istiyorsun", detail: "HADİ'de beğeni sayısı ve keşfet akışı yok; buluşma bitince sohbet de biter." },
  { text: "Yalnız çevrim içi tanışmak istiyorsun", detail: "Her etkinlik gerçek bir yerde ve saatte. Görüntülü görüşme yok." },
  { text: "Planı haftalar önceden yaparsın", detail: "Etkinlikler çoğunlukla aynı gün ya da ertesi gün." },
]
export const FOR_YOU: NotForYouItem[] = [
  { text: "Bu akşam bir şey yapmak istiyorsun", detail: "Yakınındaki etkinlikler saate göre sıralı." },
  { text: "Yeni bir şehre taşındın", detail: "Küçük gruplar, ortak ilgi alanları." },
  { text: "Kendi buluşmanı kurmak istiyorsun", detail: "Bir dakikada: ne, nerede, kaç kişi." },
]

export default function NotForYouDemo(props: { values: { variant: string; check: boolean; both: boolean } }) {
  return <div>
    {() => { const v = { ...props.values }; return <NotForYou variant={v.variant as "cards" | "list"} check={v.check} items={NOT_FOR_YOU} forYou={v.both ? FOR_YOU : undefined} /> }}
  </div>
}
