// Showcase stage for ScrollStory: four steps with markup media in the four HADİ colours.
import { ScrollStory, type StoryStep } from "./index.ts";
import { MockApp } from "../demo-kit.tsx";
import { Counter } from "../counter/index.ts";

export const code = `<ScrollStory steps={[
  { title: "Tasarla", body: "…", media: <Mock />, color: "brand-orange" },
  { title: "Kur", body: "…", media: <Chart />, color: "brand-blue" },
]} />`

export const STORY: StoryStep[] = [
  { title: "Tasarla", body: "Blokları seç, temayı ayarla: tek vurgu rengi her şeyi değiştirir.", media: <MockApp class="sc-story-mock" />, color: "brand-orange" },
  { title: "Kur", body: "Sayfalar tembel parçalar; ilk boyama 15 KB'ın altında kalır.", media: <div class="sc-story-num"><Counter value={14.6} decimals={1} suffix=" KB" /></div>, color: "brand-blue" },
  { title: "Canlandır", body: "Tek hareket motoru: yalnız transform ve opacity, görünmeyen durur.", media: <div class="sc-story-orbs"><i /><i /><i /></div>, color: "brand-green" },
  { title: "Yayınla", body: "CSP uyumlu, erişilebilir, her dilde. Bugün yayına al.", media: <div class="sc-story-num"><Counter value={100} suffix="%" /></div>, color: "brand-purple" },
]

export default function ScrollStoryDemo(props: { values: { side: string; theme: boolean } }) {
  return <div>
    {() => { const v = { ...props.values }; return <ScrollStory steps={STORY} side={v.side as "end"} theme={v.theme} /> }}
  </div>
}
