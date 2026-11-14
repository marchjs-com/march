// Showcase stage for HonestCompare: HADİ next to two kinds of alternatives, including the rows where it is behind.
import { HonestCompare, type CompareColumn, type CompareRow } from "./index.ts";

export const code = `<HonestCompare columns={[{ id: "us", name: "HADİ" }, { id: "events", name: "Etkinlik siteleri" }]}
  rows={[{ label: "Bilet satışı", values: { us: false, events: true }, note: "Planlanmıyor: HADİ ücretsiz buluşmalar için." }]} />`

export const COMPARE_COLUMNS: CompareColumn[] = [
  { id: "us", name: "HADİ" }, { id: "events", name: "Etkinlik siteleri" }, { id: "social", name: "Sosyal ağlar" },
]
export const COMPARE_ROWS: CompareRow[] = [
  { label: "Yakındaki etkinlikler, saate göre", values: { us: true, events: "partial", social: false } },
  { label: "Bir dakikada etkinlik kur", values: { us: true, events: false, social: "partial" } },
  { label: "Küçük gruplar (2–12 kişi)", values: { us: true, events: false, social: false } },
  { label: "Bilet satışı", values: { us: false, events: true, social: false }, note: "Planlamıyoruz: HADİ ücretsiz, küçük buluşmalar için. Bilet gerekiyorsa bir etkinlik sitesi daha uygun." },
  { label: "Masaüstü uygulaması", values: { us: "partial", events: true, social: true }, note: "Şimdilik yalnız web; masaüstü uygulaması yol haritasında." },
  { label: "Arkadaş listesi, takipçi", values: { us: false, events: false, social: true }, note: "Bilerek yok: buluşmadan sonra bağlantı kurmak sana kalır." },
  { label: "Fiyat", values: { us: "Ücretsiz", events: "Bilet başına komisyon", social: "Ücretsiz, reklamlı" } },
]

export default function HonestCompareDemo(props: { values: { summary: boolean; caption: boolean } }) {
  return <div>
    {() => { const v = { ...props.values }; return <HonestCompare columns={COMPARE_COLUMNS} rows={COMPARE_ROWS} summary={v.summary} showCaption={v.caption} caption="HADİ ve alternatifleri" /> }}
  </div>
}
