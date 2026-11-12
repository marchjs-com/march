// PostCard (hadi-march/ui): one post in a social feed. Header (Avatar, name with a verified mark, relative time and
// place, a ⋯ Menu), MediaGrid, an action row (LikeButton, comments and shares as rolling counts) and a caption that
// folds to three lines. A double tap on the photos likes the post: a large heart pops over the photo and bursts in the
// four HADİ colors (heartPop / heartBurst from LikeButton, motion engine).
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { Avatar } from "../../../ui/avatar.ts";
import { Menu, type MenuItem } from "../../../ui/menu.ts";
import { heart } from "../../../icons/glyphs/heart.ts";
import { message } from "../../../icons/glyphs/message.ts";
import { send } from "../../../icons/glyphs/send.ts";
import { mapPin } from "../../../icons/glyphs/mapPin.ts";
import { badgeCheck } from "../../../icons/glyphs/badgeCheck.ts";
import { moreVertical } from "../../../icons/glyphs/moreVertical.ts";
import { MediaGrid, type MediaItem } from "../../social/media-grid/index.ts";
import { LikeButton, heartBurst, heartPop } from "../../social/like-button/index.ts";
import { CountRoll } from "../../social/count-roll/index.ts";
import { animate } from "../../../motion/animate.ts";
import "./post-card.css";

export interface PostAuthor { name: string; handle?: string | undefined; avatar?: string | undefined; verified?: boolean | undefined }
export interface Post {
  id: string;
  author: PostAuthor;
  /** Date or ISO string; shown relative ("5 min. ago"). */
  time: Date | string | number;
  place?: string | undefined;
  text?: string | undefined;
  media?: readonly MediaItem[] | undefined;
  likes: number;
  liked?: boolean | undefined;
  comments?: number | undefined;
  shares?: number | undefined;
}

export interface PostCardProps {
  post: MaybeFn<Post>;
  /** Called with the next like state; update the post (optimistic). */
  onLike?: ((next: boolean, post: Post) => void) | undefined;
  onComment?: ((post: Post) => void) | undefined;
  onShare?: ((post: Post) => void) | undefined;
  onOpenMedia?: ((index: number, el: HTMLElement, post: Post) => void) | undefined;
  onAuthor?: ((post: Post) => void) | undefined;
  /** ⋯ menu items (args: [post]). */
  menu?: readonly MenuItem[] | undefined;
  /** card: framed · flat: no frame (a feed with dividers). Default card. */
  variant?: MaybeFn<"card" | "flat" | undefined>;
  /** Lines before "more". Default 3; 0 never folds. */
  clamp?: MaybeFn<number | undefined>;
  /** Double tap on the photos likes. Default true. */
  doubleTapLike?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
}

/** `<PostCard post={p} onLike={(on) => like(p, on)} onComment={openComments} onOpenMedia={(i, el) => lightbox(p.media, i, el)} />` */
export function PostCard(props: PostCardProps): Element {
  const post = (): Post => val(props.post);
  const open = signal(false);
  let big!: HTMLElement, stage!: HTMLElement;
  const like = (next: boolean): void => props.onLike?.(next, post());
  const doubleTap = (): void => {
    if (!post().liked) like(true);
    // the large heart: pop in, hold, fade (decorative)
    big.hidden = false;
    heartPop(big, true);
    heartBurst(stage, { count: 14, radius: 70 });
    void animate(big, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 900, easing: "linear" }).finished.then(() => { big.hidden = true; });
  };
  const counter = (icon: Parameters<typeof glyph>[0], n: () => number | undefined, label: () => string, fn?: () => void): Element | null =>
    fn || n() ? h("button", { type: "button", class: "hm-post-act", "aria-label": label, onClick: () => fn?.(), disabled: !fn },
      glyph(icon), h(CountRoll, { value: () => n() ?? 0, hideZero: true })) : null;
  const author = (): Element => {
    const a = post().author;
    return h("span", { class: "hm-post-name" }, h("span", { class: "hm-post-name-text" }, a.name),
      a.verified ? h("span", { class: "hm-post-verified", role: "img", "aria-label": () => t`Verified` }, glyph(badgeCheck)) : null);
  };
  return h("article", {
    class: () => cx("hm-post", `hm-post-${val(props.variant) ?? "card"}`, val(props.class)),
    "aria-label": () => t`Post by ${post().author.name}`,
  },
  h("header", { class: "hm-post-head" },
    () => {
      const a = post().author;
      const inner = [
        h(Avatar, { name: a.name, src: a.avatar, size: "md" }),
        h("span", { class: "hm-post-id" }, author(),
          h("span", { class: "hm-post-meta" },
            h("time", { dateTime: new Date(post().time).toISOString() }, applyPipe("relative", post().time)),
            post().place ? h("span", { class: "hm-post-place" }, glyph(mapPin), post().place) : null)),
      ];
      return props.onAuthor ? h("button", { type: "button", class: "hm-post-who", onClick: () => props.onAuthor?.(post()) }, inner) : h("span", { class: "hm-post-who" }, inner);
    },
    props.menu?.length ? h(Menu, { icon: moreVertical, label: () => t`Post options`, variant: "ghost", size: "sm", class: "hm-post-more", items: props.menu, args: [post()] }) : null),
  () => {
    const media = post().media;
    if (!media?.length) return null;
    return h("div", { class: "hm-post-media", ref: (x: HTMLElement) => { stage = x; } },
      h(MediaGrid, {
        items: media, gap: "thin",
        onOpen: (i: number, el: HTMLElement) => props.onOpenMedia?.(i, el, post()),
        onDoubleTap: val(props.doubleTapLike) === false ? undefined : doubleTap,
      }),
      h("span", { class: "hm-post-big", hidden: true, "aria-hidden": "true", ref: (x: HTMLElement) => { big = x; } }, glyph(heart)));
  },
  h("div", { class: "hm-post-actions" },
    h(LikeButton, { liked: () => !!post().liked, count: () => post().likes, onToggle: like, label: () => t`Like` }),
    () => counter(message, () => post().comments, () => t`Comments: ${post().comments ?? 0}`, props.onComment && (() => props.onComment?.(post()))),
    () => counter(send, () => post().shares, () => t`Share: ${post().shares ?? 0}`, props.onShare && (() => props.onShare?.(post())))),
  () => {
    const text = post().text;
    if (!text) return null;
    const lines = val(props.clamp) ?? 3;
    let p!: HTMLElement;
    const more = signal(false);
    queueMicrotask(() => { if (p && lines && p.scrollHeight > p.clientHeight + 1) more.set(true); });
    return h("div", { class: "hm-post-body" },
      h("p", { class: () => cx("hm-post-text", lines && !open() && "is-clamped"), "data-lines": String(lines), ref: (x: HTMLElement) => { p = x; } },
        h("b", { class: "hm-post-handle" }, post().author.handle ?? post().author.name), " ", text),
      () => (more() && !open() ? h("button", { type: "button", class: "hm-post-more-text", "aria-expanded": "false", onClick: () => open.set(true) }, t`more`) : null));
  },
  () => (props.onComment && post().comments ? h("button", { type: "button", class: "hm-post-all", onClick: () => props.onComment?.(post()) }, t`View all ${post().comments} comments`) : null));
}
