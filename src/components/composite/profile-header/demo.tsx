// Showcase stage for ProfileHeader: follow and watch the follower count roll with the button.
import { ProfileHeader, type ProfileUser } from "./index.ts";
import type { FollowState } from "../../social/follow-button/index.ts";
import { PHOTO } from "../../social/demo-data.ts";
import { link } from "../../../icons/glyphs/link.ts";
import { flag } from "../../../icons/glyphs/flag.ts";

export const code = `<ProfileHeader user={club} follow={$follow} onFollow={(s) => $follow = s}
  onMessage={openChat} onStat={(which) => openList(which)} onAvatar={openStories}
  menu={[{ label: "Bağlantıyı kopyala", icon: link, onSelect: copy }]} />`

export default function ProfileHeaderDemo(props: { values: { self: boolean; cover: string; story: string; photo: boolean } }) {
  let $follow: FollowState = "follow"
  let $log = ""
  const user = (): ProfileUser => ({
    name: "HADİ Koşu Kulübü", handle: "hadi.kosu", verified: true, story: props.values.story as "new",
    cover: props.values.photo ? PHOTO("sea") : undefined,
    bio: "Her pazar sabahı sahilde koşuyoruz. Tempo grupları, yeni başlayanlar için yürüyüş ve dönüşte kahve ☕",
    posts: 248, followers: 986, following: 186,
  })
  return <div class="sc-social-profile">
    <ProfileHeader user={user} self={() => props.values.self} cover={() => props.values.cover as "md"} follow={() => $follow}
      onFollow={(s) => { $follow = s }} onMessage={() => { $log = "Sohbet açılır" }} onEdit={() => { $log = "Profil düzenleme açılır" }}
      onStat={(w) => { $log = `${({ posts: "Gönderiler", followers: "Takipçiler", following: "Takip edilenler" })[w]} listesi açılır` }}
      onAvatar={() => { $log = "Hikâyeler açılır" }}
      menu={[{ label: "Bağlantıyı kopyala", icon: link, onSelect: () => { $log = "Bağlantı kopyalandı" } }, { label: "Bildir", icon: flag, danger: true, onSelect: () => { $log = "Bildirildi" } }]} />
    <p class="sc-strip-label" aria-live="polite">{() => $log}</p>
  </div>
}
