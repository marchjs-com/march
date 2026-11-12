// Showcase stage for Feed: a phone-sized feed with simulated network delay. Pull down (or Tab to Refresh), scroll to
// the end for the next page, "Yeni gönderi gelsin" queues new posts behind the pill.
import { Feed } from "./index.ts";
import type { Post } from "../post-card/index.ts";
import { Button } from "../../../ui/button.ts";
import { PHOTOS, USERS, minutesAgo } from "../../social/demo-data.ts";

export const code = `<Feed posts={$posts} loading={$first} hasMore={$more}
  onRefresh={() => api.get("/feed").then((p) => $posts = p)}
  onLoadMore={() => api.get("/feed", { after: last }).then((p) => $posts = [...$posts, ...p])}
  newCount={$waiting.length} onShowNew={() => { $posts = [...$waiting, ...$posts]; $waiting = [] }}
  onLike={(on, p) => update(p, { liked: on, likes: p.likes + (on ? 1 : -1) })} />`

const TEXTS = [
  "Bu hafta sonu sahil temizliği var, eldivenler bizden! 🌊",
  "Yeni rota denendi: orman yolu 8 km, herkes için uygun tempo.",
  "Atölyede bugün analog fotoğraf banyosu yaptık; sonuçlar harika çıktı.",
  "Kitap kulübünün ay seçimi oylamaya açıldı. Önerilerinizi yorumlara bırakın.",
  "Masa oyunları gecesi için ikinci salonu da açtık, yer kalmadı diye üzülmeyin.",
  "Akşam bisiklet turu yağmur nedeniyle yarına alındı.",
]
let seq = 0
const make = (n: number, ago = 0): Post[] => Array.from({ length: n }, (_, i) => {
  const k = seq++, u = USERS[k % (USERS.length - 1)]!
  return { id: `f${k}`, author: { name: u.name, handle: u.handle, verified: u.verified }, time: minutesAgo(ago + i * 37 + 3), text: TEXTS[k % TEXTS.length], media: PHOTOS.slice(k % 5, (k % 5) + [1, 2, 3, 0, 4, 1][k % 6]!), likes: 40 + ((k * 137) % 2400), comments: (k * 7) % 90, shares: (k * 3) % 20, liked: false, place: k % 3 ? undefined : "Sahil yolu" }
})
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function FeedDemo(props: { values: { variant: string; delay: number; pages: number; empty: boolean } }) {
  let $posts: Post[] = []
  let $first = true
  let $page = 1
  let $waiting: Post[] = []
  void wait(props.values.delay).then(() => { $posts = make(6); $first = false })
  const update = (p: Post, patch: Partial<Post>) => { $posts = $posts.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }
  return <div class="sc-social-feed-wrap">
    <div class="sc-row">
      <Button size="sm" variant="ghost" onClick={() => { $waiting = [...make(1), ...$waiting] }}>Yeni gönderi gelsin</Button>
      <span class="sc-strip-label">{() => `${$posts.length} gönderi · sayfa ${$page}/${props.values.pages}`}</span>
    </div>
    <div class="sc-social-phone">
      <Feed posts={() => (props.values.empty ? [] : $posts)} loading={() => $first} hasMore={() => $page < props.values.pages} variant={() => props.values.variant as "card"}
        newCount={() => $waiting.length} onShowNew={() => { $posts = [...$waiting, ...$posts]; $waiting = [] }}
        onRefresh={() => wait(props.values.delay).then(() => { seq = 0; $posts = make(6); $page = 1 })}
        onLoadMore={() => wait(props.values.delay).then(() => { $posts = [...$posts, ...make(6, $posts.length * 40)]; $page = $page + 1 })}
        onLike={(on, p) => update(p, { liked: on, likes: p.likes + (on ? 1 : -1) })} />
    </div>
  </div>
}
