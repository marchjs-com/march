// Showcase stage for Presentation: a short deck (title, fragments, split, numbers, closing) for the Playground values.
import { Presentation, Slide, Appear } from "./index.ts";
import { Overlay } from "../../../ui/overlay.ts";
import { Counter } from "../counter/index.ts";
import { MockApp } from "../demo-kit.tsx";

export const code = `let $slide = Number(queryParam("slide")() ?? 0)
<Presentation bind:index={$slide} transition="slide" presenterUrl="#/web?view=slides&presenter=1">
  <Slide layout="title" tone="brand" notes="Herkese merhaba">…</Slide>
  <Slide notes="Üç madde, tek tek"><h2>Neden?</h2><Appear><li>Hızlı</li><li>Erişilebilir</li><li>Güzel</li></Appear></Slide>
</Presentation>`

/** The sample deck (also used by the full-page slides sample). */
export function DemoSlides() {
  return [
    <Slide layout="title" tone="brand" notes="Herkese merhaba. Bu sunum tamamen tarayıcıda, HADI March ile.">
      <p class="sc-deck-kicker">HADI March</p>
      <h2 class="sc-deck-title">Web sitelerini yeniden düşünmek</h2>
      <p>Ok tuşları, kaydırma ya da dokunma ile ilerle</p>
    </Slide>,
    <Slide notes="Maddeler tek tek gelir: boşluk ya da sağ ok.">
      <h2>Neden yeni bir yol?</h2>
      <Appear><li>İlk boyama 15 KB'ın altında</li><li>Tek hareket motoru, görünmeyen durur</li><li>Her dilde, her yönde</li></Appear>
    </Slide>,
    <Slide layout="split" notes="Sol tarafta anlatım, sağda ürün.">
      <div><h2>Bloklarla kur</h2><p>Hero, fiyatlar, yorumlar, SSS: hepsi aynı dili konuşur.</p></div>
      <MockApp class="sc-deck-mock" />
    </Slide>,
    <Slide layout="center" tone="inverse" background={<Overlay effect="mesh" opacity={0.35} />} notes="Rakamlar görünce sayar.">
      <h2><Counter value={98.6} decimals={1} suffix="%" start="now" /></h2>
      <p>daha az JavaScript</p>
    </Slide>,
    <Slide layout="title" notes="Teşekkürler, sorular?">
      <h2 class="sc-deck-title">Teşekkürler</h2>
      <p>Sorular?</p>
    </Slide>,
  ]
}

export default function PresentationDemo(props: { values: { transition: string; presenter: boolean } }) {
  return <div>
    {() => <Presentation transition={props.values.transition as "slide"} presenter={props.values.presenter} sync="demo" label="Örnek sunum"><DemoSlides /></Presentation>}
  </div>
}
