// Showcase stage for HonestCompare: HADİ next to two kinds of alternatives, including the rows where it is behind.
import { HonestCompare, type CompareColumn, type CompareRow } from "./index.ts";

export const code = `<HonestCompare columns={[{ id: "us", name: "HADİ" }, { id: "events", name: "Etkinlik siteleri" }]}
  rows={[{ label: "Büyük konferans yönetimi", values: { us: false, events: true }, note: "HADİ bunun için tasarlanmadı." }]} />`

export const COMPARE_COLUMNS: CompareColumn[] = [
  { id: "us", name: "HADİ" }, { id: "events", name: "Etkinlik siteleri" }, { id: "social", name: "Sosyal ağlar" },
]
export const COMPARE_ROWS: CompareRow[] = [
  { label: "Yakındaki etkinlikleri keşfet", values: { us: true, events: "partial", social: "partial" } },
  { label: "Etkinlik kur, katılımcıları yönet", values: { us: true, events: true, social: "partial" } },
  { label: "Beğeni ve keşfet akışı", values: { us: true, events: false, social: true } },
  { label: "Görüntülü görüşme", values: { us: true, events: false, social: true } },
  { label: "Bilet satışı", values: { us: true, events: true, social: false } },
  { label: "Arkadaş listesi", values: { us: true, events: false, social: true } },
  { label: "Tarayıcıdan kullan, kurulum gerekmez", values: { us: true, events: true, social: true } },
  { label: "Büyük konferans yönetimi (salon, sponsor)", values: { us: false, events: true, social: false }, note: "HADİ bunun için tasarlanmadı. Yüzlerce kişilik etkinlikte bir etkinlik platformu daha uygun." },
  { label: "Profesyonel ağ", values: { us: "partial", events: false, social: true }, note: "HADİ ilgi alanlarıyla tanışmak için; iş bağlantısı için profesyonel ağlar daha güçlü." },
]

export default function HonestCompareDemo(props: { values: { summary: boolean; caption: boolean } }) {
  return <div>
    {() => { const v = { ...props.values }; return <HonestCompare columns={COMPARE_COLUMNS} rows={COMPARE_ROWS} summary={v.summary} showCaption={v.caption} caption="HADİ ve alternatifleri" /> }}
  </div>
}
