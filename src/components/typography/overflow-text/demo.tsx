// Showcase stage for OverflowText and Marquee: rows in several scripts (RTL scrolls the other way) and a ticker
// (Playground values in playground.ts).
import { OverflowText, Marquee, type MarqueeTrigger, type MarqueeMode } from "./index.ts";

export const code = `<OverflowText text={title} play={() => selected()} /> // the selected row keeps scrolling
<OverflowText text={title} />                         // hover + focus, bounces
<OverflowText trigger="visible" mode="loop" text={…} />  // endless ticker while visible
<OverflowText trigger="always" mode="once" speed={60} pause={800} />
<Marquee text="Duyuru · …" separator="✦" />          // trigger=visible, mode=loop`

const HINT: Record<string, string> = {
  hover: "Satırın üzerine gelin: sığmayan metin kayar.",
  focus: "Tab ile bir satıra gelin: odaktayken kayar.",
  always: "Sığmayan her metin sürekli kayar.",
  visible: "Ekranda göründükçe kayar.",
}

const SAMPLES = [
  ["TR", "Haftalık etkinlik özeti: Kadıköy koşu grubu, Moda sahili buluşması ve akşam yemeği"],
  ["EN", "Weekly digest: Saturday running club, beach clean-up meetup and the community dinner"],
  ["AR", "ملخص الأسبوع: نادي الجري يوم السبت، لقاء تنظيف الشاطئ وعشاء المجتمع"],
  ["Karışık", "Acme — مرحبا بكم في المجتمع — welcome to the community"],
  ["Kısa", "Sığan metin kaymaz"],
] as const

export default function OverflowTextDemo(props: { values: { trigger: string; mode: string; speed: number; ticker: boolean } }) {
  return <div class="sc-mq-demo">
    {() => { const trigger = props.values.trigger as MarqueeTrigger, mode = props.values.mode as MarqueeMode, speed = props.values.speed; return <div class="sc-mq-list">
      <p class="hm-muted">{HINT[trigger]} İlk satır seçili satır gibi hep kayar (play).</p>
      {SAMPLES.map(([lang, text], i) => <button type="button" class="sc-mq-row"><span class="sc-mq-lang">{lang}</span><OverflowText class="sc-mq-text" text={text} trigger={trigger} mode={mode} speed={speed} play={i === 0 ? () => true : undefined} /></button>)}
    </div> }}
    {() => (props.values.ticker ? <div class="sc-mq-ticker"><Marquee text="Yeni: koyu tema · daha hızlı arama · tam RTL · dört resmi renk" separator="✦" speed={props.values.speed} /></div> : null)}
  </div>
}
