// Showcase stage for Skeleton: lines, a block or a whole card while "loading"; the button swaps in the real content.
import { Skeleton } from "./index.ts";
import { Button } from "../../../ui/button.ts";

export const code = `<Skeleton lines={3} />
<Skeleton block height="lg" />
{() => (loading() ? <Skeleton lines={2} colors="brand" /> : <Profile />)}`

export default function SkeletonDemo(props: { values: { mode: string; lines: number; height: string; colors: string } }) {
  let $loading = true
  return <div class="sc-col">
    <div class="sc-row"><Button size="sm" on:click={() => { $loading = !$loading }}>{() => ($loading ? "Yüklemeyi bitir" : "Yeniden yükle")}</Button></div>
    {() => {
      const v = props.values
      const colors = v.colors === "theme" ? undefined : (v.colors as "brand")
      if (!$loading) return <div class="sc-skel-real"><strong>HADİ</strong><p class="hm-muted">Veri geldi; iskelet aynı düzenin yerini aldı ve hiçbir şey zıplamadı.</p></div>
      if (v.mode === "lines") return <Skeleton lines={v.lines} colors={colors} />
      if (v.mode === "block") return <Skeleton block height={v.height as "md"} colors={colors} />
      return <div class="sc-skel-card"><Skeleton block height={v.height as "md"} colors={colors} /><Skeleton lines={v.lines} colors={colors} /></div>
    }}
  </div>
}
