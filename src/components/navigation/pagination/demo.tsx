// Showcase stage for Pagination: a result list paged by the control (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { Pagination } from "./index.ts";

export const code = `<Pagination bind:page={$page} pages={20} siblings={1} />`

export default function PaginationDemo(props: { values: { pages: number; siblings: number } }) {
  const page = signal(5)
  const clamp = (): number => Math.min(page(), props.values.pages)
  return <div class="sc-page-demo">
    <p class="hm-muted">{() => `Sonuçlar ${(clamp() - 1) * 10 + 1}–${clamp() * 10} · sayfa ${clamp()} / ${props.values.pages}`}</p>
    {() => { const siblings = props.values.siblings; return <Pagination page={clamp} pages={() => props.values.pages} siblings={siblings} setPage={(p: number) => page.set(p)} /> }}
  </div>
}
