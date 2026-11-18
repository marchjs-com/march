// ProfileHeader (march/ui): the top of a profile. A cover (photo, or the four HADİ colors in a soft gradient) with
// a bottom dim; the avatar in a StoryRing overlapping it (opens the stories); name with a verified mark, handle and bio;
// stats as buttons with rolling counts (CountRoll); a FollowButton that morphs, a Message button and a ⋯ Menu. Following
// bumps the follower count, so the number rolls with the button.
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { message } from "../../../icons/glyphs/message.ts";
import { moreVertical } from "../../../icons/glyphs/moreVertical.ts";
import { Button } from "../../actions/button/index.ts";
import { Card } from "../../data/card/index.ts";
import { StatTile } from "../../data/stat-tile/index.ts";
import { Picture } from "../../media/picture/index.ts";
import { VerifiedMark } from "../../social/verified-mark/index.ts";
import { Menu, type MenuItem } from "../../../ui/menu.ts";
import { StoryRing, type StoryRingState } from "../../social/story-ring/index.ts";
import { FollowButton, type FollowState } from "../../social/follow-button/index.ts";
import { CountRoll } from "../../social/count-roll/index.ts";
import "./profile-header.css";
import { withColor } from "../../../theme/colors.ts";
import type { IconProp } from "../../../icons/types.ts";

export interface ProfileUser {
  name: string;
  handle?: string | undefined;
  avatar?: string | undefined;
  cover?: string | undefined;
  bio?: string | undefined;
  verified?: boolean | undefined;
  /** Story ring around the avatar. Default none. */
  story?: StoryRingState | undefined;
  posts?: number | undefined;
  followers?: number | undefined;
  following?: number | undefined;
  private?: boolean | undefined;
}

/** The texts ProfileHeader writes itself; every one is optional (default: the built-in text). */
export interface ProfileHeaderLabels {
  /** Name of the section. */
  profile?: (name: string) => string;
  edit?: string; message?: string; more?: string; verified?: string; posts?: string; followers?: string; following?: string;
}
type Stat = "posts" | "followers" | "following";

export interface ProfileHeaderProps {
  /** The profile: name, handle, avatar, cover, bio, verified, story, counts, private (or an accessor). @tr Profil: ad, kullanıcı adı, avatar, kapak, biyografi, onay, hikâye, sayılar, gizlilik (ya da bir erişimci). */
  user: MaybeFn<ProfileUser>;
  /** Your own profile: no follow / message, an Edit button instead (onEdit). @tr Senin kendi profilin: takip / mesaj yok, yerine bir Edit düğmesi (onEdit). */
  self?: MaybeFn<boolean | undefined>;
  /** The follow state for the FollowButton (default "follow"); following adds one to the followers. @tr FollowButton'ın takip durumu (varsayılan "follow"); "following" takipçilere bir ekler. */
  follow?: MaybeFn<FollowState | undefined>;
  /** Called with the next follow state; without it there is no follow button. @tr Yeni takip durumuyla çağrılır; verilmezse takip düğmesi olmaz. */
  onFollow?: ((next: FollowState) => void) | undefined;
  /** Called by the Message button; without it there is no Message button. @tr Message düğmesi tarafından çağrılır; verilmezse Message düğmesi olmaz. */
  onMessage?: (() => void) | undefined;
  /** Called by the Edit profile button of your own profile (`self`). @tr Kendi profilindeki (`self`) Edit profile düğmesi tarafından çağrılır. */
  onEdit?: (() => void) | undefined;
  /** Makes the stats buttons; called with posts, followers or following. @tr İstatistikleri düğme yapar; posts, followers ya da following ile çağrılır. */
  onStat?: ((which: "posts" | "followers" | "following") => void) | undefined;
  /** Makes the avatar a button (its story ring opens the stories). @tr Avatarı bir düğme yapar (hikâye halkası hikâyeleri açar). */
  onAvatar?: (() => void) | undefined;
  /** ⋯ menu items. @tr ⋯ menüsünün öğeleri. */
  menu?: readonly MenuItem[] | undefined;
  /** Cover height: sm 120 · md 168 · lg 216 px. Default md. @tr Kapak yüksekliği: sm 120 · md 168 · lg 216 px. Varsayılan md. */
  cover?: MaybeFn<"sm" | "md" | "lg" | "none" | undefined>;
  /** Own texts (section name, Edit profile, Message, the stat names …). @tr Kendi metinlerin (bölüm adı, Edit profile, Message, istatistik adları …). */
  labels?: MaybeFn<ProfileHeaderLabels | undefined>;
  /** The stats row: true (default: all three), false, or the ones to show in order (`["followers", "following"]`). @tr İstatistik satırı: true (varsayılan: üçü de), false ya da sırasıyla gösterilecekler (`["followers", "following"]`). */
  stats?: MaybeFn<boolean | readonly ("posts" | "followers" | "following")[] | undefined>;
  /** Own icons (an icon of march/icons, text or a node); `false` hides the verified mark or the Message icon. @tr Kendi ikonların (march/icons ikonu, metin ya da düğüm); `false` onay işaretini ya da Message ikonunu gizler. */
  verifiedIcon?: IconProp;
  /** Own icon of the Message button (icon, text or node); `false` hides it. @tr Message düğmesinin kendi ikonu (ikon, metin ya da düğüm); `false` gizler. */
  messageIcon?: IconProp;
  /** Own icon of the ⋯ menu button (icon, text or node). @tr ⋯ menü düğmesinin kendi ikonu (ikon, metin ya da düğüm). */
  menuIcon?: IconProp;
  /** Color of the Message button (default: a neutral surface). @tr Message düğmesinin rengi (varsayılan: nötr bir yüzey). */
  messageColor?: ColorToken | undefined;
  /** Extra classes on the section. @tr Bölüme (section) eklenen ek sınıflar. */
  class?: ClassProp;
}

const ALL: readonly Stat[] = ["posts", "followers", "following"];

/** `<ProfileHeader user={u} follow={$f} onFollow={(s) => $f = s} onMessage={openChat} onStat={openList} />` */
export function ProfileHeader(props: ProfileHeaderProps): Element {
  const u = (): ProfileUser => val(props.user);
  const L = (): ProfileHeaderLabels => val(props.labels) ?? {};
  const shown = (): readonly Stat[] => { const s = val(props.stats); return s === false ? [] : Array.isArray(s) ? s as readonly Stat[] : ALL; };
  // following adds you to the followers: the count rolls together with the button
  const followers = (): number => (u().followers ?? 0) + (val(props.follow) === "following" ? 1 : 0);
  // a soft StatTile whose figure rolls; a button when the list behind it can be opened
  const stat = (which: Stat, n: () => number, label: () => string): Element =>
    h(StatTile, { class: "m-prof-stat", variant: "tile", value: h(CountRoll, { value: n }), label, onClick: props.onStat && (() => props.onStat?.(which)) }) as Element;
  // the frame is a Card (a section, no body padding)
  return h(Card, { flush: true, class: () => cx("m-prof", `m-prof-cover-${val(props.cover) ?? "md"}`, val(props.class)), "aria-label": () => L().profile?.(u().name) ?? t`Profile of ${u().name}` },
    () => (val(props.cover) === "none" ? null : h("div", { class: "m-prof-cover", "aria-hidden": "true" },
      () => { const c = u().cover; return c ? h(Picture, { src: c, alt: "", fit: "cover", loading: "eager" }) : h("span", { class: "m-prof-cover-art" }, h("i"), h("i"), h("i"), h("i")); })),
    h("div", { class: "m-prof-top" },
      h(StoryRing, { name: () => u().name, src: () => u().avatar, size: "lg", state: () => u().story ?? "none", onClick: props.onAvatar, class: "m-prof-avatar" }),
      h("div", { class: "m-prof-actions" },
        () => (val(props.self)
          ? (props.onEdit ? h(Button, { variant: "secondary", onClick: () => props.onEdit?.() }, () => L().edit ?? t`Edit profile`) : null)
          : [
            props.onFollow ? h(FollowButton, { state: () => val(props.follow) ?? "follow", name: () => u().name, private: () => !!u().private, onChange: (s: FollowState) => props.onFollow?.(s) }) : null,
            props.onMessage ? withColor(h(Button, { class: "m-prof-msg", variant: props.messageColor ? "primary" : "secondary", icon: ownIcon(props.messageIcon, message, null), onClick: () => props.onMessage?.() },
              () => L().message ?? t`Message`), props.messageColor) : null,
          ]),
        props.menu?.length ? h(Menu, { icon: props.menuIcon ?? moreVertical, label: () => L().more ?? t`More`, variant: "ghost", items: props.menu, class: "m-prof-more" }) : null)),
    h("div", { class: "m-prof-id" },
      h("h2", { class: "m-prof-name" }, h("span", null, () => u().name),
        () => (u().verified && props.verifiedIcon !== false ? h(VerifiedMark, { class: "m-prof-verified", size: "md", label: () => L().verified ?? t`Verified`, icon: props.verifiedIcon }) : null)),
      () => (u().handle ? h("span", { class: "m-prof-handle" }, `@${u().handle}`) : null),
      () => (u().bio ? h("p", { class: "m-prof-bio" }, u().bio) : null)),
    () => {
      const list = shown();
      if (!list.length) return null;
      return h("div", { class: "m-prof-stats", "data-n": String(list.length) }, list.map((w) => (w === "posts" ? stat(w, () => u().posts ?? 0, () => L().posts ?? t`Posts`)
        : w === "followers" ? stat(w, followers, () => L().followers ?? t`Followers`)
        : stat(w, () => u().following ?? 0, () => L().following ?? t`Following`))));
    }) as Element;
}
