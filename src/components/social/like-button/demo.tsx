// Showcase stage for LikeButton: one heart with the Playground options, plus heartBurst on a plain tile.
import { LikeButton, heartBurst, heartPop } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<LikeButton liked={$liked} count={$likes}
  onToggle={(on) => { $liked = on; $likes += on ? 1 : -1 }} />
heartBurst(photoEl)   // the same burst anywhere (double-tap on a photo)`

export default function LikeButtonDemo(props: { values: { size: string; burst: boolean; colors: string; color: string; count: boolean } }) {
  let $liked = false
  let $likes = 128
  let tile!: HTMLElement, mark!: HTMLElement
  return <div class="sc-row sc-social-like" data-hm-color={props.values.color}>
    {() => <LikeButton liked={() => $liked} count={props.values.count ? () => $likes : undefined} size={props.values.size as "md"}
      burst={props.values.burst} colors={props.values.colors as "brand"} color={props.values.color as ColorToken}
      onToggle={(on) => { $liked = on; $likes = $likes + (on ? 1 : -1) }} />}
    <button type="button" class="sc-social-burst-tile" ref={(x: Element) => { tile = x as HTMLElement }}
      onClick={() => { heartPop(mark, true); if (props.values.burst) heartBurst(tile, { radius: 46, count: 14, colors: props.values.colors as "brand" }) }}>
      <span class="sc-social-burst-mark" aria-hidden="true" ref={(x: Element) => { mark = x as HTMLElement }}>♥</span>
      <code>heartBurst()</code>
    </button>
  </div>
}
