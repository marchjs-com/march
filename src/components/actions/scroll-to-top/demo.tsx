// Showcase stage for ScrollToTop: a scrolling box with its own inline button (the page itself has one in the corner).
// The icon, the colour and the way the button appears follow the Playground values.
import { ScrollToTop } from "./index.ts";
import { chevronUp } from "../../../icons/glyphs/chevronUp.ts";
import { animate } from "../../../motion/animate.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `// once in the app shell: shows after scrolling, sits in the page corner
<ScrollToTop />
<ScrollToTop threshold={600} />      // later
<ScrollToTop inline target={box} />  // inside a scrolling box
<ScrollToTop icon={chevronUp} color="brand-blue" motion="fade" />   // motion: pop | fade | slide | none | (el, shown) => …`

export default function ScrollToTopDemo(props: { values: { threshold: number; motion: string; icon: string; color: string } }) {
  const lines = Array.from({ length: 14 }, (_, i) => <p>{`HADİ bülteni, bölüm ${i + 1}: aşağı kaydır, düğme belirsin.`}</p>)
  const box = (<div class="sc-totop-box">{lines}</div>) as HTMLElement
  return <div class="sc-totop">
    {box}
    <div class="sc-totop-slot">{() => {
      const v = props.values
      const spin = (el: HTMLElement, shown: boolean) => animate(el, shown
        ? [{ opacity: 0, transform: "rotate(-180deg) scale(0.6)" }, { opacity: 1, transform: "none" }]
        : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "rotate(180deg) scale(0.6)" }], { duration: 420, easing: "easeOutCubic", fill: "forwards" })
      return <ScrollToTop inline target={box} threshold={v.threshold} motion={v.motion === "own" ? spin : v.motion as "pop"}
        icon={v.icon === "chevron" ? chevronUp : v.icon === "text" ? "⇧" : undefined} color={(v.color || undefined) as never} />
    }}</div>
  </div>
}
