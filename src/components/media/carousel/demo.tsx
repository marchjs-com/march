// Showcase stage for Carousel: slides per view and the slide count from the Playground values (playground.ts).
import { Carousel } from "./index.ts";
import { arrowLeft } from "../../../icons/glyphs/arrowLeft.ts";
import { arrowRight } from "../../../icons/glyphs/arrowRight.ts";

export const code = `<Carousel perView={3} label="Özellikler">
  {items.map((x) => <article class="card">{x.title}</article>)}
</Carousel>
<Carousel color="brand-orange" prevIcon={arrowLeft} nextIcon={arrowRight} dots={(i) => i + 1}
  labels={{ previous: "Önceki", next: "Sonraki", slide: (n) => n + ". kart" }}>…</Carousel>
<Carousel arrows={false} dots={false}>…</Carousel>`

const NAMES = ["Heyecan", "Aktivite", "Dostluk", "İletişim"]

export default function CarouselDemo(props: { values: { perView: number; slides: number; arrows: string; dots: string; color: string } }) {
  return <div class="sc-col">
    {() => {
      const v = props.values
      const own = v.arrows === "own"
      return <Carousel perView={v.perView as 1} label="HADİ koleksiyonu" arrows={v.arrows !== "off"} prevIcon={own ? arrowLeft : undefined} nextIcon={own ? arrowRight : undefined}
        dots={v.dots === "off" ? false : v.dots === "own" ? (i: number) => String(i + 1) : true} color={v.color === "primary" ? undefined : (v.color as "brand-orange")}
        labels={{ slide: (n) => `${n}. kart` }}>
        {Array.from({ length: v.slides }, (_, i) => <article class={`sc-car-slide sc-car-${i % 4}`}><strong>{i + 1}</strong><span>{NAMES[i % 4]}</span></article>)}
      </Carousel>
    }}
  </div>
}
