// Showcase stage for FollowButton: press it to follow (or send a request to a private account), press again to undo.
import { FollowButton, type FollowState } from "./index.ts";

export const code = `<FollowButton state={$state} name={user.name} private={user.private}
  onChange={(s) => { $state = s; api.follow(user.id, s) }} />`

export default function FollowButtonDemo(props: { values: { private: boolean; size: string; block: boolean } }) {
  let $state: FollowState = "follow"
  return <div class="sc-social-follow">
    {() => <FollowButton state={() => $state} name="HADİ Koşu Kulübü" private={props.values.private} size={props.values.size as "md"} block={props.values.block} onChange={(s) => { $state = s }} />}
    <p class="sc-strip-label" aria-live="polite">{() => ({ follow: "Takip etmiyorsunuz", following: "Takip ediyorsunuz", requested: "İstek bekliyor" })[$state]}</p>
  </div>
}
