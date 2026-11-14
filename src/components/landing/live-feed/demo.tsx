// Showcase stage for LiveFeed: sample HADİ activity, one new line every couple of seconds.
import { LiveFeed, type FeedItem } from "./index.ts";

export const code = `<LiveFeed next={() => nextActivity()} every={2400} max={5} />
<LiveFeed items={$events} variant="wall" live="polite" />   // newest first, pushed from a socket`

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
export function activitySource(): () => FeedItem {
  let i = 0
  return () => {
    const k = i++, who = PEOPLE[(k * 5) % PEOPLE.length]!, [what, body] = ACTS[(k * 3) % ACTS.length]!, where = CITIES[(k * 7) % CITIES.length]!
    return { id: `a${k}`, avatar: who[0], title: `${who} ${what}`, body: `${where} · ${body}`, meta: "şimdi", color: COLORS[k % COLORS.length] }
  }
}

export default function LiveFeedDemo(props: { values: { variant: string; every: number; max: number } }) {
  return <div class="sc-lf-stage">
    {() => { const v = { ...props.values }; return <LiveFeed variant={v.variant as "list" | "wall"} every={v.every} max={v.max} next={activitySource()} label="HADİ'de şimdi" /> }}
  </div>
}
