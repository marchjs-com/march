// Showcase stage for Roadmap.
import { Roadmap, type RoadmapItem } from "./index.ts";

export const code = `<Roadmap items={[
  { time: "2025 · 1. çeyrek", title: "İlk sürüm", body: "…", status: "done" },
  { time: "2026 · 3. çeyrek", title: "Ekipler", body: "…", status: "now" },
  { time: "2027", title: "Eklentiler", body: "…", status: "next" },
]} />`

export const ROADMAP: RoadmapItem[] = [
  { time: "2025 · 1. çeyrek", title: "İlk sürüm", body: "Çekirdek, yönlendirici ve 40 bileşen.", status: "done" },
  { time: "2025 · 3. çeyrek", title: "Tek hareket motoru", body: "Her animasyon tek saatte; görünmeyen durur.", status: "done" },
  { time: "2026 · 2. çeyrek", title: "Web sitesi blokları", body: "Hero, fiyatlar, portfolyo ve sunum.", status: "now" },
  { time: "2026 · 4. çeyrek", title: "Görsel düzenleyici", body: "Blokları sürükle, temayı canlı ayarla.", status: "next" },
  { time: "2027", title: "Eklenti pazarı", body: "Toplulukların blok ve temaları.", status: "next" },
]

export default function RoadmapDemo(props: { values: { badges: boolean; scroll: boolean } }) {
  return <div class="sc-rm-demo">
    {() => <Roadmap items={ROADMAP} badges={props.values.badges} scroll={props.values.scroll} />}
  </div>
}
