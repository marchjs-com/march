// Showcase stage for PullToRefresh: a short feed in a fixed-height scroll area (playground.ts sets threshold, delay).
import { PullToRefresh, type PullPhase } from "./index.ts";
import { Icon } from "../../../icons/index.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";
import { arrowDown } from "../../../icons/glyphs/arrowDown.ts";
import { arrowUp } from "../../../icons/glyphs/arrowUp.ts";
import { hourglass } from "../../../icons/glyphs/hourglass.ts";

export const code = `<PullToRefresh onRefresh={() => api.get("/feed").then((x) => $items = x)} threshold={72}>
  <For each={$items}>{(it) => <FeedRow item={it} />}</For>
</PullToRefresh>
<PullToRefresh onRefresh={load} icon={sparkles} color="brand-orange" labels={{ refresh: "Yeni etkinlikleri getir" }} settle={false}>…</PullToRefresh>
<PullToRefresh onRefresh={load} indicator={(phase) => <Icon of={phase === "ready" ? arrowUp : arrowDown} />}>…</PullToRefresh>`

const NAMES = ["Kadıköy koşu grubu", "Moda sahili buluşması", "Akşam yemeği", "Kitap kulübü", "Bisiklet turu", "Fotoğraf yürüyüşü", "Masa oyunları", "Kahve sohbeti"]

export default function PullToRefreshDemo(props: { values: { threshold: number; delay: number; indicator: string; color: string; settle: boolean; disabled: boolean } }) {
  let $round = 0
  let $phase = "idle"
  const PHASES: Record<string, string> = { idle: "Hazır", pull: "Çekiliyor", ready: "Bırakınca yenilenir", refreshing: "Yenileniyor…" }
  const items = () => Array.from({ length: 14 }, (_, i) => `${NAMES[(i + $round) % NAMES.length]} · ${$round ? `${$round}. yenileme` : "ilk liste"}`)
  return <div class="sc-ptr-wrap">
    <span class="sc-strip-label" aria-live="polite">{() => `Durum: ${props.values.disabled ? "kapalı, çekmek yenilemez" : PHASES[$phase]} · eşik ${props.values.threshold}px`}</span>
    {() => <PullToRefresh threshold={props.values.threshold} disabled={props.values.disabled} onPhase={(p) => { $phase = p }}
      indicator={props.values.indicator === "off" ? false : props.values.indicator === "own" ? (p: PullPhase) => <Icon of={p === "refreshing" ? hourglass : p === "ready" ? arrowUp : arrowDown} /> : true}
      icon={props.values.indicator === "icon" ? sparkles : undefined} color={props.values.color === "primary" ? undefined : (props.values.color as "success")}
      settle={props.values.settle ? undefined : false} labels={{ refresh: "Listeyi yenile" }}
      onRefresh={() => new Promise((r) => setTimeout(r, props.values.delay)).then(() => { $round = $round + 1 })}
      class="sc-ptr-demo">
      <ul class="sc-ptr-list">{() => items().map((x) => <li>{x}</li>)}</ul>
    </PullToRefresh>}
  </div>
}
