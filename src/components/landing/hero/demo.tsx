// Showcase stage for Hero: every variant with the same copy; product and split get the markup product mock.
import { Hero, type HeroVariant } from "./index.ts";
import { MockApp } from "../demo-kit.tsx";
import { arrowRight } from "../../../icons/glyphs/arrowRight.ts";

export const code = `<Hero variant="mesh" eyebrow="Yeni: 2.0" title="Web sitesi kurmanın en hızlı yolu" highlight="en hızlı"
  lead="…" note="Kart gerekmez" actions={[{ label: "Ücretsiz başla", href: "/start", iconEnd: arrowRight }, { label: "Demo izle" }]} />
<Hero variant="product" media={<img src="/screen.png" alt="…" width={1600} height={1000} />} … />
<Hero variant="video" video={{ src: "/clip.webm", poster: "/clip.jpg" }} … />`

export default function HeroDemo(props: { values: { variant: string; size: string; eyebrow: boolean; note: boolean } }) {
  return <div class="sc-site-frame sc-hero-frame">
    {() => {
      const v = props.values, variant = v.variant as HeroVariant
      return <Hero variant={variant} size={v.size as "md"} eyebrow={v.eyebrow ? "Yeni: sürüm 2.0" : undefined} eyebrowHref={v.eyebrow ? "#" : undefined}
        title="Web sitesi kurmanın en hızlı yolu" highlight="en hızlı"
        lead="Hazır bloklar, akıcı hareket ve sıfır bağımlılık. Tanıtım sayfan dakikalar içinde yayında."
        note={v.note ? "Kredi kartı gerekmez · 2 dakikada kurulum" : undefined}
        actions={[{ label: "Ücretsiz başla", iconEnd: arrowRight }, { label: "Demo izle", variant: "secondary" }]}
        media={variant === "product" || variant === "split" ? <MockApp /> as Node : undefined}
        video={{ src: "media/hadi-waves.webm", poster: "media/hadi-waves.jpg" }}
        layers={[{ content: <div class="sc-plx-sky" />, speed: 0.45 }, { content: <svg class="sc-plx-far" viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden="true"><path d="M0 260 C 200 160 340 220 520 170 S 900 120 1200 210 V400 H0 Z" /></svg>, speed: 0.3 }, { content: <svg class="sc-plx-mid" viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden="true"><path d="M0 300 C 160 240 380 300 600 250 S 980 230 1200 290 V400 H0 Z" /></svg>, speed: 0.15 }]} />
    }}
  </div>
}
