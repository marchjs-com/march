// Showcase stage for ScrollStory: four steps with markup media in the four HADİ colours.
import { ScrollStory, type StoryStep } from "./index.ts";
import { MockApp } from "../demo-kit.tsx";
import { Counter } from "../counter/index.ts";

export const code = `<ScrollStory steps={[
  { title: "Keşfet", body: "…", media: <Map />, color: "brand-orange" },
  { title: "Katıl", body: "…", media: <Count />, color: "brand-blue" },
]} />`

export const STORY: StoryStep[] = [
  { title: "Keşfet", body: "Yakınındaki etkinlikler, ilgi alanına göre: bugün, bu hafta sonu, gelecek ay.", media: <MockApp class="sc-story-mock" />, color: "brand-orange" },
  { title: "Katıl", body: "Tek dokunuşla yerini ayır; gerekiyorsa biletini al. Kimlerin geleceğini önceden gör.", media: <div class="sc-story-num"><Counter value={12} suffix=" kişi" /></div>, color: "brand-blue" },
  { title: "Tanış", body: "Etkinlik sohbetinde merhaba de, istersen görüntülü tanış. Buluşmada kimse yabancı kalmaz.", media: <div class="sc-story-orbs"><i /><i /><i /></div>, color: "brand-green" },
  { title: "Paylaş", body: "Anıları akışta ve hikâyelerde paylaş; yeni arkadaşlarını listene ekle.", media: <div class="sc-story-num"><Counter value={48} suffix=" anı" /></div>, color: "brand-purple" },
]

export default function ScrollStoryDemo(props: { values: { side: string; theme: boolean } }) {
  return <div>
    {() => { const v = { ...props.values }; return <ScrollStory steps={STORY} side={v.side as "end"} theme={v.theme} /> }}
  </div>
}
