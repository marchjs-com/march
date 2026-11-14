// Showcase stage for NotForYou: who HADİ is not for (and who it is for); mark the lines that apply.
import { NotForYou, type NotForYouItem } from "./index.ts";

export const code = `<NotForYou check items={[{ text: "Hep aynı beş arkadaşla buluşuyorsun", detail: "…" }]}
  forYou={[{ text: "Yeni insanlarla tanışmak istiyorsun" }]} />`

export const NOT_FOR_YOU: NotForYouItem[] = [
  { text: "Hep aynı beş arkadaşla buluşuyorsun", detail: "Yeni biri gelmesin istiyorsan bir mesaj grubu sana yeter.", instead: "Yeni yüzlere açıksın: HADİ'de her hafta yeni insanlarla tanışırsın." },
  { text: "Tek bir sade sohbet istiyorsun", detail: "HADİ akış, sohbet, etkinlik, tanışma: hepsi bir arada. Sana fazla gelebilir.", instead: "Hepsi bir arada olsun istiyorsun: sohbet, akış, etkinlik ve tanışma tek uygulamada." },
  { text: "Yeni insanlarla tanışmak istemiyorsun", detail: "HADİ'nin kapısı hep yeni insanlara açık.", instead: "Tanışmak istiyorsun: tanışma yemekleri ve etkinlikler seni bekliyor." },
  { text: "Telefonu az açmak istiyorsun", detail: "Akış, hikâyeler, etkinlik bildirimleri: HADİ'de hep bir şey oluyor.", instead: "Hareketli bir hayat seviyorsun: HADİ'de her gün yeni bir şey var." },
]
export const FOR_YOU: NotForYouItem[] = [
  { text: "Yeni insanlarla tanışmak istiyorsun", detail: "Tanışma yemekleri, ilgi alanına göre gruplar." },
  { text: "Etkinlik bulmak da kurmak da istiyorsun", detail: "Planlı etkinlikler, takvim, gerekirse bilet." },
  { text: "Sohbet, akış ve etkinlik tek yerde olsun", detail: "Ayrı ayrı uygulama yerine tek bir HADİ." },
]

export default function NotForYouDemo(props: { values: { variant: string; check: boolean; both: boolean } }) {
  return <div>
    {() => { const v = { ...props.values }; return <NotForYou variant={v.variant as "cards" | "list"} check={v.check} markedHint="Sen bir HADİ'lisin" items={NOT_FOR_YOU} forYou={v.both ? FOR_YOU : undefined} /> }}
  </div>
}
