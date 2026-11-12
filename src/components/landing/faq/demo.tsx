// Showcase stage for Faq.
import { Faq, type FaqItem } from "./index.ts";
import { Button } from "../../../ui/button.ts";

export const code = `<Faq layout="split" search title="Sık sorulanlar" lead="…" contact={<Button variant="secondary">Bize yaz</Button>}
  items={[{ q: "Ücretsiz mi?", a: "Evet, MIT lisanslı." }, …]} />`

export const FAQ: FaqItem[] = [
  { q: "Ücretsiz mi?", a: "Evet. Kütüphane MIT lisanslıdır; ticari projelerde de ücretsiz kullanılır." },
  { q: "Hangi tarayıcılarda çalışır?", a: "Son iki sürümdeki tüm modern tarayıcılarda. Eski tarayıcılarda hareketler sade bir geçişe düşer." },
  { q: "Sağdan sola diller destekleniyor mu?", a: "Evet. Tüm bloklar mantıksal CSS kullanır; yönlü hareketler RTL'de aynalanır.", keywords: "arapça ibranice rtl" },
  { q: "Sayfam ne kadar büyük olur?", a: "Yalnız kullandığın bloklar derlenir. Tipik bir tanıtım sayfası 40 KB'ın altında kalır." },
  { q: "Kendi tasarım sistemimle kullanabilir miyim?", a: "Evet. Renkler, yazı ve yarıçaplar tokenlardır; tek vurgu rengi her şeyi değiştirir." },
  { q: "Hareketi kapatabilir miyim?", a: "Sistem ayarındaki azaltılmış hareket her animasyonu sadeleştirir; tek çağrıyla tümünü durdurabilirsin.", keywords: "animasyon reduced motion" },
]

export default function FaqDemo(props: { values: { layout: string; search: boolean; multiple: boolean } }) {
  return <div>
    {() => {
      const v = props.values
      return <Faq layout={v.layout as "split"} search={v.search} multiple={v.multiple} items={FAQ} title="Sık sorulanlar" lead="Aradığını bulamadın mı? Ekibimiz bir gün içinde yanıt verir." contact={<Button variant="secondary">Bize yaz</Button>} />
    }}
  </div>
}
