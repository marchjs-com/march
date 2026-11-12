// ProfileHeader (hadi-march/ui): the top of a profile. A cover (photo, or the four HADİ colors in a soft gradient) with
// a bottom dim; the avatar in a StoryRing overlapping it (opens the stories); name with a verified mark, handle and bio;
// stats as buttons with rolling counts (CountRoll); a FollowButton that morphs, a Message button and a ⋯ Menu. Following
// bumps the follower count, so the number rolls with the button.
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { badgeCheck } from "../../../icons/glyphs/badgeCheck.ts";
import { message } from "../../../icons/glyphs/message.ts";
import { moreVertical } from "../../../icons/glyphs/moreVertical.ts";
import { Button } from "../../../ui/button.ts";
import { Menu, type MenuItem } from "../../../ui/menu.ts";
import { StoryRing, type StoryRingState } from "../../social/story-ring/index.ts";
import { FollowButton, type FollowState } from "../../social/follow-button/index.ts";
import { CountRoll } from "../../social/count-roll/index.ts";
import "./profile-header.css";

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

export interface ProfileHeaderProps {
  user: MaybeFn<ProfileUser>;
  /** Your own profile: no follow / message, an Edit button instead (onEdit). */
  self?: MaybeFn<boolean | undefined>;
  follow?: MaybeFn<FollowState | undefined>;
  onFollow?: ((next: FollowState) => void) | undefined;
  onMessage?: (() => void) | undefined;
  onEdit?: (() => void) | undefined;
  onStat?: ((which: "posts" | "followers" | "following") => void) | undefined;
  onAvatar?: (() => void) | undefined;
  menu?: readonly MenuItem[] | undefined;
  /** Cover height: sm 120 · md 168 · lg 216 px. Default md. */
  cover?: MaybeFn<"sm" | "md" | "lg" | "none" | undefined>;
  class?: ClassProp;
}

/** `<ProfileHeader user={u} follow={$f} onFollow={(s) => $f = s} onMessage={openChat} onStat={openList} />` */
export function ProfileHeader(props: ProfileHeaderProps): Element {
  const u = (): ProfileUser => val(props.user);
  // following adds you to the followers: the count rolls together with the button
  const followers = (): number => (u().followers ?? 0) + (val(props.follow) === "following" ? 1 : 0);
  const stat = (which: "posts" | "followers" | "following", n: () => number, label: () => string): Element =>
    h(props.onStat ? "button" : "div", { ...(props.onStat ? { type: "button", onClick: () => props.onStat?.(which) } : {}), class: "hm-prof-stat" },
      h("b", null, h(CountRoll, { value: n })), h("span", null, label));
  return h("section", { class: () => cx("hm-prof", `hm-prof-cover-${val(props.cover) ?? "md"}`, val(props.class)), "aria-label": () => t`Profile of ${u().name}` },
    () => (val(props.cover) === "none" ? null : h("div", { class: "hm-prof-cover", "aria-hidden": "true" },
      () => { const c = u().cover; return c ? h("img", { src: c, alt: "", decoding: "async" }) : h("span", { class: "hm-prof-cover-art" }, h("i"), h("i"), h("i"), h("i")); })),
    h("div", { class: "hm-prof-top" },
      h(StoryRing, { name: () => u().name, src: () => u().avatar, size: "lg", state: () => u().story ?? "none", onClick: props.onAvatar, class: "hm-prof-avatar" }),
      h("div", { class: "hm-prof-actions" },
        () => (val(props.self)
          ? (props.onEdit ? h(Button, { variant: "secondary", onClick: () => props.onEdit?.() }, t`Edit profile`) : null)
          : [
            props.onFollow ? h(FollowButton, { state: () => val(props.follow) ?? "follow", name: () => u().name, private: () => !!u().private, onChange: (s: FollowState) => props.onFollow?.(s) }) : null,
            props.onMessage ? h("button", { type: "button", class: "hm-prof-msg", onClick: () => props.onMessage?.() }, glyph(message), h("span", null, t`Message`)) : null,
          ]),
        props.menu?.length ? h(Menu, { icon: moreVertical, label: () => t`More`, variant: "ghost", items: props.menu, class: "hm-prof-more" }) : null)),
    h("div", { class: "hm-prof-id" },
      h("h2", { class: "hm-prof-name" }, h("span", null, () => u().name),
        () => (u().verified ? h("span", { class: "hm-prof-verified", role: "img", "aria-label": () => t`Verified` }, glyph(badgeCheck)) : null)),
      () => (u().handle ? h("span", { class: "hm-prof-handle" }, `@${u().handle}`) : null),
      () => (u().bio ? h("p", { class: "hm-prof-bio" }, u().bio) : null)),
    h("div", { class: "hm-prof-stats" },
      stat("posts", () => u().posts ?? 0, () => t`Posts`),
      stat("followers", followers, () => t`Followers`),
      stat("following", () => u().following ?? 0, () => t`Following`)));
}
