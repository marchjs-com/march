// Showcase stage for HonestCompare: HADİ next to an ordinary small event group, including the rows where it is behind.
import { HonestCompare, type CompareColumn, type CompareRow } from "./index.ts";

export const code = `<HonestCompare columns={[{ id: "us", name: "HADİ" }, { id: "group", name: "Küçük etkinlik grubu" }]}
  rows={[{ label: "Sade: tek sohbet", values: { us: false, group: true }, note: "HADİ çok şey yapar." }]} />`

export const COMPARE_COLUMNS: CompareColumn[] = [
  { id: "us", name: "HADİ" }, { id: "group", name: "Küçük etkinlik grubu" },
]
export const COMPARE_ROWS: CompareRow[] = [
  { label: "Yeni etkinlik keşfet", values: { us: true, group: false } },
  { label: "Yeni insanlarla tanış", values: { us: true, group: "partial" } },
  { label: "Planlı etkinlikler ve takvim", values: { us: true, group: "partial" } },
  { label: "Bilet satışı", values: { us: true, group: false } },
  { label: "Sohbet, akış, görüntülü görüşme", values: { us: true, group: "partial" } },
  { label: "Arkadaş listesi", values: { us: true, group: false } },
  { label: "Herkes birbirini tanır", values: { us: "partial", group: true }, note: "Küçük bir grupta herkes tanıdık. HADİ'de de kendi grubunu kurabilirsin, ama kapı yeni insanlara hep açık." },
  { label: "Sade: tek sohbet, başka bir şey yok", values: { us: false, group: true }, note: "HADİ çok şey yapar; yalnız beş arkadaşla buluşmak istiyorsan bir mesaj grubu daha sade." },
  { label: "Kurulum", values: { us: "Uygulama ya da tarayıcı", group: "Bir mesaj grubu" } },
]

export default function HonestCompareDemo(props: { values: { summary: boolean; caption: boolean } }) {
  return <div>
    {() => { const v = { ...props.values }; return <HonestCompare columns={COMPARE_COLUMNS} rows={COMPARE_ROWS} summary={v.summary} showCaption={v.caption} caption="HADİ ve küçük bir etkinlik grubu" /> }}
  </div>
}
