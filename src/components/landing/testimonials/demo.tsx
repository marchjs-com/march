// Showcase stage for Testimonials: neutral people and companies.
import { Testimonials, type Testimonial } from "./index.ts";

export const code = `<Testimonials variant="wall" items={[
  { quote: "Bir hafta sonunda yeni sitemiz yayındaydı.", name: "Deniz Arı", role: "Ürün lideri, Acme", rating: 5 },
  …
]} />`

export const QUOTES: Testimonial[] = [
  { quote: "Bir hafta sonunda yeni sitemiz yayındaydı ve ilk boyama yarıya indi.", name: "Deniz Arı", role: "Ürün lideri, Acme", rating: 5 },
  { quote: "Hareketler akıcı ama asla abartılı değil. Müşterilerimiz farkı hemen gördü.", name: "Mert Kaya", role: "Tasarım, Northwind", rating: 5 },
  { quote: "RTL ve çok dil desteği kutudan çıktığı gibi çalıştı; Arapça sürüm bir günde hazırdı.", name: "Leyla Demir", role: "Mühendislik, Orbit", rating: 5 },
  { quote: "Bloklar birbirine çok iyi uyuyor. Tema rengini değiştirdik, her şey takip etti.", name: "Can Yıldız", role: "Ortak, Kite", rating: 4 },
  { quote: "Erişilebilirlik denetiminden ilk seferde geçtik.", name: "Ece Tan", role: "Ön yüz, Lumen", rating: 5 },
  { quote: "Portfolyo şablonunu kendi projelerimle doldurdum, akşam yayındaydı.", name: "Arda Su", role: "Serbest tasarımcı", rating: 5 },
  { quote: "Fiyat tablosundaki geçiş müşterilerin en çok sevdiği ayrıntı oldu.", name: "Selin Ak", role: "Pazarlama, Quanta", rating: 5 },
  { quote: "Bağımlılık yok, CSP sorunu yok. Güvenlik ekibimiz ilk kez itiraz etmedi.", name: "Bora Er", role: "Güvenlik, Helix", rating: 5 },
]

export default function TestimonialsDemo(props: { values: { variant: string; cols: number } }) {
  return <div>
    {() => {
      const v = { ...props.values }
      return <Testimonials variant={v.variant as "grid"} cols={v.cols as 3} items={QUOTES} />
    }}
  </div>
}
