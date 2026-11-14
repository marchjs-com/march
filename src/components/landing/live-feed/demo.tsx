// Showcase stage for LiveFeed: sample HADİ activity, one new line every couple of seconds. Every option change starts
// the feed again with other lines and brings the first new one after 0.6 s, so the chosen motion shows at once.
import { LiveFeed, type FeedItem } from "./index.ts";

export const code = `<LiveFeed next={() => nextActivity()} every={2400} max={5} enter="drop" leave="fall" />
<LiveFeed items={$events} variant="wall" live="polite" />   // newest first, pushed from a socket
<LiveFeed next={next} enter={{ keyframes: { opacity: [0, 1], transform: ["rotate(-6deg) scale(.8)", "none"] }, duration: 500 }} />`

const PEOPLE = ["Elif", "Mert", "Zeynep", "Can", "Deniz", "Ece", "Arda", "Selin", "Bora", "Leyla", "Kerem", "Defne"]
const CITIES = ["Kadıköy", "Beşiktaş", "Çankaya", "Karşıyaka", "Nilüfer", "Muratpaşa", "Ortahisar", "Tepebaşı"]
const ACTS: [string, string][] = [
  ["akşam koşusuna katıldı", "5 km, tempo serbest"],
  ["tanışma yemeğinde yerini ayırdı", "6 kişilik masa"],
  ["bir kitap kulübü kurdu", "ilk buluşma pazar"],
  ["seramik atölyesine bilet aldı", "2 yer kaldı"],
  ["masa oyunu gecesine katıldı", "yeni başlayanlar hoş geldi"],
  ["bir hikâye paylaştı", "sahil yürüyüşünden"],
  ["fotoğraf yürüyüşü başlattı", "cumartesi 10:00"],
  ["dil kafesine katıldı", "İspanyolca masası"],
]
const COLORS = ["brand-orange", "brand-blue", "brand-green", "brand-purple"] as const

/** A source of sample activity: every call returns a new line (deterministic order, no randomness in tests). */
export function activitySource(from = 0): () => FeedItem {
  let i = from
  return () => {
    const k = i++, who = PEOPLE[(k * 5) % PEOPLE.length]!, [what, body] = ACTS[(k * 3) % ACTS.length]!, where = CITIES[(k * 7) % CITIES.length]!
    return { id: `a${k}`, avatar: who[0], title: `${who} ${what}`, body: `${where} · ${body}`, meta: "şimdi", color: COLORS[k % COLORS.length] }
  }
}

let round = 0
export default function LiveFeedDemo(props: { values: { variant: string; enter: string; leave: string; glow: boolean; every: number; max: number } }) {
  return <div class="sc-lf-stage">
    {() => { const v = { ...props.values }; return <LiveFeed variant={v.variant as "list" | "wall"} enter={v.enter as "flip"} leave={v.leave as "blur"} glow={v.glow} every={v.every} first={600} max={v.max} next={activitySource(round++ * 7)} label="HADİ'de şimdi" /> }}
  </div>
}
