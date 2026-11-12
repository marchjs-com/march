// Showcase stage for ScrollToTop: a scrolling box with its own inline button (the page itself has one in the corner).
import { ScrollToTop } from "./index.ts";

export const code = `// once in the app shell: shows after scrolling, sits in the page corner
<ScrollToTop />
<ScrollToTop threshold={600} />      // later
<ScrollToTop inline target={box} />  // inside a scrolling box`

export default function ScrollToTopDemo(props: { values: { threshold: number } }) {
  const lines = Array.from({ length: 14 }, (_, i) => <p>{`HADİ bülteni, bölüm ${i + 1}: aşağı kaydır, düğme belirsin.`}</p>)
  const box = (<div class="sc-totop-box">{lines}</div>) as HTMLElement
  return <div class="sc-totop">
    {box}
    <div class="sc-totop-slot">{() => <ScrollToTop inline target={box} threshold={props.values.threshold} />}</div>
  </div>
}
