// Showcase stage for PullToRefresh: a short feed in a fixed-height scroll area (playground.ts sets threshold, delay).
import { PullToRefresh } from "./index.ts";

export const code = `<PullToRefresh onRefresh={() => api.get("/feed").then((x) => $items = x)} threshold={72}>
  <For each={$items}>{(it) => <FeedRow item={it} />}</For>
</PullToRefresh>`

const NAMES = ["Kadıköy koşu grubu", "Moda sahili buluşması", "Akşam yemeği", "Kitap kulübü", "Bisiklet turu", "Fotoğraf yürüyüşü", "Masa oyunları", "Kahve sohbeti"]

export default function PullToRefreshDemo(props: { values: { threshold: number; delay: number; disabled: boolean } }) {
  let $round = 0
  let $phase = "idle"
  const PHASES: Record<string, string> = { idle: "Hazır", pull: "Çekiliyor", ready: "Bırakınca yenilenir", refreshing: "Yenileniyor…" }
  const items = () => Array.from({ length: 14 }, (_, i) => `${NAMES[(i + $round) % NAMES.length]} · ${$round ? `${$round}. yenileme` : "ilk liste"}`)
  return <div class="sc-ptr-wrap">
    <span class="sc-strip-label" aria-live="polite">{() => `Durum: ${props.values.disabled ? "kapalı, çekmek yenilemez" : PHASES[$phase]} · eşik ${props.values.threshold}px`}</span>
    {() => <PullToRefresh threshold={props.values.threshold} disabled={props.values.disabled} onPhase={(p) => { $phase = p }}
      onRefresh={() => new Promise((r) => setTimeout(r, props.values.delay)).then(() => { $round = $round + 1 })}
      class="sc-ptr-demo">
      <ul class="sc-ptr-list">{() => items().map((x) => <li>{x}</li>)}</ul>
    </PullToRefresh>}
  </div>
}
