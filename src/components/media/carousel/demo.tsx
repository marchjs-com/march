// Showcase stage for Carousel: slides per view and the slide count from the Playground values (playground.ts).
import { Carousel } from "./index.ts";

export const code = `<Carousel perView={3} label="Özellikler">
  {items.map((x) => <article class="card">{x.title}</article>)}
</Carousel>`

const NAMES = ["Heyecan", "Aktivite", "Dostluk", "İletişim"]

export default function CarouselDemo(props: { values: { perView: number; slides: number } }) {
  return <div class="sc-col">
    {() => {
      const v = props.values
      return <Carousel perView={v.perView as 1} label="HADİ koleksiyonu">
        {Array.from({ length: v.slides }, (_, i) => <article class={`sc-car-slide sc-car-${i % 4}`}><strong>{i + 1}</strong><span>{NAMES[i % 4]}</span></article>)}
      </Carousel>
    }}
  </div>
}
