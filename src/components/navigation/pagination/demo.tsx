// Showcase stage for Pagination: a result list paged by the control (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { Pagination } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<Pagination bind:page={$page} pages={20} siblings={1} />
<Pagination bind:page={$page} pages={20} prev="‹ Geri" next="İleri ›" gap="·" color="brand-blue" />   // kendi metnin, işaretin, rengin
<Pagination bind:page={$page} pages={5} controls={false} gap={false} />                               // yalnız numaralar`

export default function PaginationDemo(props: { values: { pages: number; siblings: number; controls: string; gap: string; color: string } }) {
  const page = signal(5)
  const clamp = (): number => Math.min(page(), props.values.pages)
  return <div class="sc-page-demo">
    <p class="hm-muted">{() => `Sonuçlar ${(clamp() - 1) * 10 + 1}–${clamp() * 10} · sayfa ${clamp()} / ${props.values.pages}`}</p>
    {() => {
      const siblings = props.values.siblings, c = props.values.controls, g = props.values.gap, color = (props.values.color || undefined) as ColorToken
      return <Pagination page={clamp} pages={() => props.values.pages} siblings={siblings} setPage={(p: number) => page.set(p)} color={color}
        controls={c !== "off"} prev={c === "text" ? "‹ Geri" : undefined} next={c === "text" ? "İleri ›" : undefined}
        gap={g === "off" ? false : g === "own" ? "·" : undefined} />
    }}
  </div>
}
