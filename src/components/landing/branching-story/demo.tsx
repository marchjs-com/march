// Showcase stage for BranchingStory: "A Saturday on HADİ", a short story with five endings (sample content).
import { BranchingStory, type StoryPassage } from "./index.ts";

export const code = `<BranchingStory start="intro" passages={{
  intro: { title: "Cumartesi sabahı", body: "…", choices: [{ label: "Etkinliklere bak", to: "explore" }, { label: "Kendi buluşmamı kur", to: "host" }] },
  explore: { body: "…", choices: [ … ] },
  friends: { title: "Yeni arkadaşlar", body: "…", ending: "Sosyal kelebek" },
}} action={<Button>HADİ'ye katıl</Button>} />`

const Scene = (props: { kind: string; label: string }) => <div class={`sc-bs-scene sc-bs-${props.kind}`} aria-hidden="true"><i /><i /><i /><span>{props.label}</span></div>

export const SATURDAY: Record<string, StoryPassage> = {
  intro: { title: "Cumartesi sabahı", color: "brand-orange", media: <Scene kind="sun" label="09:12" />,
    body: <p>Hafta sonu boş. HADİ'yi açtın; yakınında bir sürü şey oluyor. Ne yapmak istersin?</p>,
    choices: [
      { label: "Yakınımdaki etkinliklere bakayım", note: "Kadıköy · bugün 14 etkinlik", to: "explore" },
      { label: "Kendi buluşmamı kurayım", note: "birkaç adımda", to: "host" },
      { label: "Akşam için tanışma yemeğine yer ayırtayım", note: "6 kişilik masalar", to: "dinner" },
    ] },
  explore: { title: "Yakınında bugün", color: "brand-blue", media: <Scene kind="map" label="3 km" />,
    body: <p>Üç etkinlik gözüne çarpıyor: sahilde koşu, kafede masa oyunu gecesi ve gün batımında fotoğraf yürüyüşü.</p>,
    choices: [
      { label: "Sahil koşusu", note: "10:00 · 5 km · 12 kişi", to: "run" },
      { label: "Masa oyunu gecesi", note: "15:00 · yeni başlayanlar hoş geldi", to: "games" },
    ] },
  run: { title: "Sahilde", color: "brand-green", media: <Scene kind="wave" label="5 km" />,
    body: <p>Isınırken yanındaki "İlk kez mi geliyorsun?" diye soruyor. Koşu bitince grup kahve içmeye gidiyor.</p>,
    choices: [
      { label: "Ben de geliyorum", to: "friends" },
      { label: "Fotoğrafları paylaşıp eve döneyim", to: "story" },
    ] },
  games: { title: "Masa oyunu gecesi", color: "brand-purple", media: <Scene kind="dice" label="4–6" />,
    body: <p>Masada dört kişisiniz; kuralları en iyi bilen sensin. Oyun bitince biri haftaya tekrar buluşmayı öneriyor.</p>,
    choices: [
      { label: "Etkinliği ben kurayım", to: "regular" },
      { label: "Arkadaş olarak ekleyelim", to: "friends" },
    ] },
  host: { title: "Kendi buluşman", color: "brand-orange", media: <Scene kind="pin" label="+1" />,
    body: <p>Ne kuruyorsun? Yer ve saat belli; kontenjanı sen belirliyorsun.</p>,
    choices: [
      { label: "Kitap kulübü, 8 kişi", note: "ücretsiz", to: "regular" },
      { label: "Seramik atölyesi, biletli", note: "bilet HADİ'den", to: "tickets" },
    ] },
  dinner: { title: "Akşam 20:00", color: "brand-blue", media: <Scene kind="table" label="6" />,
    body: <p>Altı kişilik masada herkesin ortak ilgisi seyahat. Tatlıya gelmeden bir sonraki rota konuşuluyor.</p>,
    choices: [
      { label: "Rota grubuna katıl", to: "friends" },
      { label: "Görüntülü tanışmayı sürdür", note: "uzaktaki bir arkadaş da katılıyor", to: "story" },
    ] },
  friends: { title: "Yeni arkadaşlar", ending: "Sosyal kelebek", color: "brand-green", media: <Scene kind="hearts" label="+4" />,
    body: <p>Gün bitmeden arkadaş listen dört kişi büyüdü. Hafta içi sohbet hiç durmadı.</p> },
  story: { title: "Anılar akışta", ending: "Hikâye anlatıcısı", color: "brand-purple", media: <Scene kind="hearts" label="48" />,
    body: <p>Paylaştığın hikâye kırk sekiz beğeni aldı; iki kişi bir dahaki etkinliği soruyor.</p> },
  regular: { title: "Her hafta", ending: "Topluluk lideri", color: "brand-orange", media: <Scene kind="pin" label="her salı" />,
    body: <p>Etkinliğini tekrarlayan yaptın. Üçüncü haftada yeni gelenler eskileri geçti.</p> },
  tickets: { title: "Biletler tükendi", ending: "Girişimci", color: "brand-blue", media: <Scene kind="table" label="12/12" />,
    body: <p>Atölyenin on iki bileti bir günde bitti; bekleme listesine yedi kişi yazıldı.</p> },
}

export default function BranchingStoryDemo(props: { values: { trail: boolean; endings: boolean } }) {
  return <div>
    {() => { const v = { ...props.values }; return <BranchingStory start="intro" passages={SATURDAY} trail={v.trail} endings={v.endings} label="HADİ'de bir cumartesi" /> }}
  </div>
}
