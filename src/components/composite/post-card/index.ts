// PostCard (hadi-march/ui): one post in a social feed. Header (Avatar, name with a verified mark, relative time and
// place, a ⋯ Menu), MediaGrid, an action row (LikeButton, comments and shares as rolling counts) and a caption that
// folds to three lines. A double tap on the photos likes the post: a large heart pops over the photo and bursts in the
// four HADİ colors (heartPop / heartBurst from LikeButton, motion engine).
import { signal, computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { isIconDef, type IconDef } from "../../../icons/svg.ts";
import type { ColorToken } from "../../../theme/colors.ts";
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

/** The texts PostCard writes itself; every one is optional (default: the built-in text). */
export interface PostCardLabels {
  /** Name of the article. */
  post?: (author: string) => string;
  verified?: string;
  /** Name of the ⋯ menu. */
  options?: string;
  like?: string;
  comments?: (count: number) => string;
  share?: (count: number) => string;
  more?: string;
  viewAll?: (count: number) => string;
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
  /** Own texts (names of the article and the buttons, "more", "View all N comments"). */
  labels?: MaybeFn<PostCardLabels | undefined>;
  /** The author's avatar. Default true. */
  avatar?: boolean | undefined;
  /** The time in the header: true (default, relative), false, or `(time) => content`. */
  time?: boolean | ((time: Post["time"]) => unknown) | undefined;
  /** Own icons (an icon of hadi-march/icons, text or a node); `false` hides the verified mark, the place pin or the large heart. */
  verifiedIcon?: unknown;
  placeIcon?: unknown;
  commentIcon?: unknown;
  shareIcon?: unknown;
  menuIcon?: unknown;
  /** The large heart of a double tap: default, `false` (the post is liked without it) or your own node. */
  bigHeart?: unknown;
  /** Heart color while liked (default: brand-pink). */
  likeColor?: ColorToken | undefined;
  /** The "View all N comments" line. Default true. */
  viewAll?: boolean | undefined;
  class?: ClassProp;
}

// an own icon (IconDef, text or node) or the built-in glyph
const own = (x: unknown, def: IconDef): unknown => (x == null ? glyph(def) : isIconDef(x) ? glyph(x) : icon(x));

/** `<PostCard post={p} onLike={(on) => like(p, on)} onComment={openComments} onOpenMedia={(i, el) => lightbox(p.media, i, el)} />` */
export function PostCard(props: PostCardProps): Element {
  const post = (): Post => val(props.post);
  const open = signal(false);
  const L = (): PostCardLabels => val(props.labels) ?? {};
  // the photos and the caption redraw only when they really change (a like must not reload the images)
  const sameMedia = (a?: readonly MediaItem[], b?: readonly MediaItem[]): boolean => a === b || (!!a && !!b && a.length === b.length && a.every((x, i) => x.src === b[i]?.src));
  const media = computed(() => post().media, { equals: sameMedia });
  const caption = computed(() => `${post().author.handle ?? post().author.name}\u0000${post().text ?? ""}`);
  const head = computed(() => { const p = post(); return `${p.author.name}\u0000${p.author.avatar ?? ""}\u0000${p.author.verified ? 1 : 0}\u0000${String(p.time)}\u0000${p.place ?? ""}`; });
  let big: HTMLElement | undefined, stage!: HTMLElement;
  const like = (next: boolean): void => props.onLike?.(next, post());
  const doubleTap = (): void => {
    if (!post().liked) like(true);
    if (!big) return;
    // the large heart: pop in, hold, fade (decorative)
    big.hidden = false;
    heartPop(big, true);
    heartBurst(stage, { count: 14, radius: 70 });
    void animate(big, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 900, easing: "linear" }).finished.then(() => { if (big) big.hidden = true; });
  };
  // a count button: shown while it has a handler or a count; the button stays while the number changes (it rolls)
  const counter = (mark: () => unknown, n: () => number | undefined, label: () => string, fn?: () => void): (() => Element | null) => {
    const shown = computed(() => !!fn || !!n());
    return () => (shown() ? untrack(() => h("button", { type: "button", class: "hm-post-act", "aria-label": label, onClick: () => fn?.(), disabled: !fn },
      mark(), h(CountRoll, { value: () => n() ?? 0, hideZero: true }))) : null);
  };
  const author = (): Element => {
    const a = untrack(post).author;
    return h("span", { class: "hm-post-name" }, h("span", { class: "hm-post-name-text" }, a.name),
      a.verified && props.verifiedIcon !== false ? h("span", { class: "hm-post-verified", role: "img", "aria-label": () => L().verified ?? t`Verified` }, own(props.verifiedIcon, badgeCheck)) : null);
  };
  return h("article", {
    class: () => cx("hm-post", `hm-post-${val(props.variant) ?? "card"}`, val(props.class)),
    "aria-label": () => L().post?.(post().author.name) ?? t`Post by ${post().author.name}`,
  },
  h("header", { class: "hm-post-head" },
    () => {
      head();
      const a = untrack(post).author;
      const inner = [
        props.avatar === false ? null : h(Avatar, { name: a.name, src: a.avatar, size: "md" }),
        h("span", { class: "hm-post-id" }, author(),
          h("span", { class: "hm-post-meta" },
            props.time === false ? null : h("time", { dateTime: new Date(untrack(post).time).toISOString() }, typeof props.time === "function" ? props.time(untrack(post).time) : applyPipe("relative", untrack(post).time)),
            untrack(post).place ? h("span", { class: "hm-post-place" }, props.placeIcon === false ? null : own(props.placeIcon, mapPin), untrack(post).place) : null)),
      ];
      return props.onAuthor ? h("button", { type: "button", class: "hm-post-who", onClick: () => props.onAuthor?.(post()) }, inner) : h("span", { class: "hm-post-who" }, inner);
    },
    props.menu?.length ? h(Menu, { icon: props.menuIcon ?? moreVertical, label: () => L().options ?? t`Post options`, variant: "ghost", size: "sm", class: "hm-post-more", items: props.menu, args: [post()] }) : null),
  () => {
    const items = media();
    if (!items?.length) return null;
    return h("div", { class: "hm-post-media", ref: (x: HTMLElement) => { stage = x; } },
      h(MediaGrid, {
        items, gap: "thin",
        onOpen: (i: number, el: HTMLElement) => props.onOpenMedia?.(i, el, post()),
        onDoubleTap: val(props.doubleTapLike) === false ? undefined : doubleTap,
      }),
      props.bigHeart === false ? null : h("span", { class: "hm-post-big", hidden: true, "aria-hidden": "true", ref: (x: HTMLElement) => { big = x; } }, own(props.bigHeart, heart)));
  },
  h("div", { class: "hm-post-actions" },
    h(LikeButton, { liked: () => !!post().liked, count: () => post().likes, onToggle: like, label: () => L().like ?? t`Like`, color: props.likeColor }),
    counter(() => own(props.commentIcon, message), () => post().comments, () => L().comments?.(post().comments ?? 0) ?? t`Comments: ${post().comments ?? 0}`, props.onComment && (() => props.onComment?.(post()))),
    counter(() => own(props.shareIcon, send), () => post().shares, () => L().share?.(post().shares ?? 0) ?? t`Share: ${post().shares ?? 0}`, props.onShare && (() => props.onShare?.(post())))),
  () => {
    const [handle, text] = caption().split("\u0000") as [string, string];
    if (!text) return null;
    const lines = val(props.clamp) ?? 3;
    let p!: HTMLElement;
    const more = signal(false);
    queueMicrotask(() => { if (p && lines && p.scrollHeight > p.clientHeight + 1) more.set(true); });
    return h("div", { class: "hm-post-body" },
      h("p", { class: () => cx("hm-post-text", lines && !open() && "is-clamped"), "data-lines": String(lines), ref: (x: HTMLElement) => { p = x; } },
        h("b", { class: "hm-post-handle" }, handle), " ", text),
      () => (more() && !open() ? h("button", { type: "button", class: "hm-post-more-text", "aria-expanded": "false", onClick: () => open.set(true) }, L().more ?? t`more`) : null));
  },
  () => (props.onComment && post().comments && props.viewAll !== false ? h("button", { type: "button", class: "hm-post-all", onClick: () => props.onComment?.(post()) }, L().viewAll?.(post().comments ?? 0) ?? t`View all ${post().comments} comments`) : null));
}
