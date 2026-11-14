// Showcase stage for PostCard: one post driven by the Playground options; like / comment / share are optimistic.
import { PostCard, type Post } from "./index.ts";
import { PHOTOS, user, minutesAgo } from "../../social/demo-data.ts";
import { flag } from "../../../icons/glyphs/flag.ts";
import { link } from "../../../icons/glyphs/link.ts";
import { eyeOff } from "../../../icons/glyphs/eyeOff.ts";
import { zap } from "../../../icons/glyphs/zap.ts";
import { star } from "../../../icons/glyphs/star.ts";
import { settings } from "../../../icons/glyphs/settings.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export const code = `<PostCard post={post}
  onLike={(on) => update({ liked: on, likes: post.likes + (on ? 1 : -1) })}
  onComment={() => openComments(post)}
  onOpenMedia={(i, el) => openLightbox(post.media, i, el)}
  menu={[{ label: "Bağlantıyı kopyala", icon: link, onSelect: copy }, { label: "Bildir", icon: flag, danger: true, onSelect: report }]} />`

const TEXT = "Pazar sabahı sahil koşusu tamamlandı! 🧡 Yeni katılan herkese hoş geldiniz; tempo grubu 6:30'da, yürüyüş grubu 7:00'de buluşuyor. Gelecek hafta rota orman yoluna taşınıyor, ayrıntılar etkinlik sayfasında."

export default function PostCardDemo(props: { values: { photos: number; variant: string; clamp: number; menu: boolean; doubleTapLike: boolean; place: boolean; avatar: boolean; time: string; icons: boolean; likeColor: string } }) {
  let $post: Post = { id: "p1", author: { ...user("u1") }, time: minutesAgo(18), place: "Sahil yolu", text: TEXT, media: PHOTOS.slice(0, 3), likes: 1284, liked: false, comments: 46, shares: 12 }
  let $log = ""
  const post = (): Post => ({ ...$post, media: PHOTOS.slice(0, props.values.photos), place: props.values.place ? "Sahil yolu" : undefined })
  return <div class="sc-social-post">
    {() => <PostCard post={post} variant={props.values.variant as "card"} clamp={props.values.clamp} doubleTapLike={props.values.doubleTapLike}
      avatar={props.values.avatar} likeColor={props.values.likeColor as ColorToken}
      time={props.values.time === "off" ? false : props.values.time === "own" ? (t) => new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : true}
      commentIcon={props.values.icons ? zap : undefined} shareIcon={props.values.icons ? star : undefined} menuIcon={props.values.icons ? settings : undefined}
      onLike={(on) => { $post = { ...$post, liked: on, likes: $post.likes + (on ? 1 : -1) } }}
      onComment={() => { $log = "Yorumlar açılır" }} onShare={() => { $post = { ...$post, shares: ($post.shares ?? 0) + 1 }; $log = "Paylaşıldı" }}
      onOpenMedia={(i) => { $log = `${i + 1}. fotoğraf açılır` }} onAuthor={() => { $log = "Profil açılır" }}
      menu={props.values.menu ? [{ label: "Bağlantıyı kopyala", icon: link, onSelect: () => { $log = "Bağlantı kopyalandı" } }, { label: "Gizle", icon: eyeOff, onSelect: () => { $log = "Gönderi gizlendi" } }, "-", { label: "Bildir", icon: flag, danger: true, onSelect: () => { $log = "Bildirildi" } }] : undefined} />}
    <p class="sc-strip-label" aria-live="polite">{() => $log}</p>
  </div>
}
