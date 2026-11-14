// Showcase stage for FollowButton: press it to follow (or send a request to a private account), press again to undo.
// Texts, icon, color, burst and the morph follow the Playground.
import { FollowButton, type FollowState } from "./index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Icon } from "../../../icons/index.ts";
import { star } from "../../../icons/glyphs/star.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";

export const code = `<FollowButton state={$state} name={user.name} private={user.private}
  onChange={(s) => { $state = s; api.follow(user.id, s) }} />
<FollowButton state={$state} onChange={set} labels={{ follow: "Katıl", following: "Üyesin" }}
  color="brand-green" icon={(s) => <Icon of={s === "follow" ? sparkles : star} />} burst={false} />`

type Values = { private: boolean; size: string; block: boolean; labels: string; icon: string; color: string; burst: boolean; morph: boolean }

export default function FollowButtonDemo(props: { values: Values }) {
  let $state: FollowState = "follow"
  return <div class="sc-social-follow">
    {() => {
      const v = props.values
      return <FollowButton state={() => $state} name="HADİ Koşu Kulübü" private={v.private} size={v.size as "md"} block={v.block}
        labels={v.labels === "own" ? { follow: "Katıl", following: "Üyesin", requested: "Onay bekliyor" } : undefined}
        icon={v.icon === "off" ? false : v.icon === "own" ? (s: FollowState) => <Icon of={s === "follow" ? sparkles : star} /> : true}
        color={v.color as ColorToken} burst={v.burst} morph={v.morph} onChange={(s) => { $state = s }} />
    }}
    <p class="sc-strip-label" aria-live="polite">{() => ({ follow: "Takip etmiyorsunuz", following: "Takip ediyorsunuz", requested: "İstek bekliyor" })[$state]}</p>
  </div>
}
