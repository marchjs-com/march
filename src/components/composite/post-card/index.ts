// PostCard (march/ui): one post in a social feed. Header (Avatar, name with a verified mark, relative time and
// place, a ⋯ Menu), MediaGrid, an action row (LikeButton, comments and shares as rolling counts) and a caption that
// folds to three lines. A double tap on the photos likes the post: a large heart pops over the photo and bursts in the
// four HADİ colors (heartPop / heartBurst: motion/burst.ts).
import { signal, computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { Avatar } from "../../social/avatar/index.ts";
import { VerifiedMark } from "../../social/verified-mark/index.ts";
import { Button } from "../../actions/button/index.ts";
import { Card } from "../../data/card/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { ClampText } from "../../typography/clamp-text/index.ts";
import { Menu, type MenuItem } from "../../../ui/menu.ts";
import { heart } from "../../../icons/glyphs/heart.ts";
import { message } from "../../../icons/glyphs/message.ts";
import { send } from "../../../icons/glyphs/send.ts";
import { mapPin } from "../../../icons/glyphs/mapPin.ts";
import { moreVertical } from "../../../icons/glyphs/moreVertical.ts";
import { MediaGrid, type MediaItem } from "../../social/media-grid/index.ts";
import { LikeButton } from "../../social/like-button/index.ts";
import { heartBurst, heartPop } from "../../../motion/burst.ts";
import { CountRoll } from "../../social/count-roll/index.ts";
import { animate } from "../../../motion/animate.ts";
import "./post-card.css";
import { withColor } from "../../../theme/colors.ts";
import type { IconProp } from "../../../icons/types.ts";

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
  /** The post: author, time, place, text, media and counts (or an accessor). @tr Gönderi: yazar, zaman, yer, metin, medya ve sayılar (ya da bir erişimci). */
  post: MaybeFn<Post>;
  /** Called with the next like state; update the post (optimistic). @tr Yeni beğeni durumuyla çağrılır; gönderiyi güncelle (iyimser). */
  onLike?: ((next: boolean, post: Post) => void) | undefined;
  /** Called by the comment button and the "View all N comments" line. @tr Yorum düğmesi ve "View all N comments" satırı tarafından çağrılır. */
  onComment?: ((post: Post) => void) | undefined;
  /** Called by the share button. @tr Paylaş düğmesi tarafından çağrılır. */
  onShare?: ((post: Post) => void) | undefined;
  /** Called when a photo is opened, with its index and tile (open a MediaLightbox from it). @tr Bir fotoğraf açıldığında sırası ve karosuyla çağrılır (oradan bir MediaLightbox aç). */
  onOpenMedia?: ((index: number, el: HTMLElement, post: Post) => void) | undefined;
  /** Makes the author a button (to the profile); called with the post. @tr Yazarı bir düğme yapar (profile gider); gönderiyle çağrılır. */
  onAuthor?: ((post: Post) => void) | undefined;
  /** ⋯ menu items (args: [post]). @tr ⋯ menüsünün öğeleri (argümanlar: [post]). */
  menu?: readonly MenuItem[] | undefined;
  /** card: framed · flat: no frame (a feed with dividers). Default card. @tr card: çerçeveli · flat: çerçevesiz (ayırıcılı bir akış). Varsayılan card. */
  variant?: MaybeFn<"card" | "flat" | undefined>;
  /** Lines before "more". Default 3; 0 never folds. @tr "more" öncesindeki satır sayısı. Varsayılan 3; 0 hiç katlamaz. */
  clamp?: MaybeFn<number | undefined>;
  /** Double tap on the photos likes. Default true. @tr Fotoğraflara çift dokunuş beğenir. Varsayılan true. */
  doubleTapLike?: MaybeFn<boolean | undefined>;
  /** Own texts (names of the article and the buttons, "more", "View all N comments"). @tr Kendi metinlerin (makalenin ve düğmelerin adları, "more", "View all N comments"). */
  labels?: MaybeFn<PostCardLabels | undefined>;
  /** The author's avatar. Default true. @tr Yazarın avatarı. Varsayılan true. */
  avatar?: boolean | undefined;
  /** The time in the header: true (default, relative), false, or `(time) => content`. @tr Başlıktaki zaman: true (varsayılan, göreli), false ya da `(time) => içerik`. */
  time?: boolean | ((time: Post["time"]) => unknown) | undefined;
  /** Own icons (an icon of march/icons, text or a node); `false` hides the verified mark, the place pin or the large heart. @tr Kendi ikonların (march/icons ikonu, metin ya da düğüm); `false` onay işaretini, yer iğnesini ya da büyük kalbi gizler. */
  verifiedIcon?: IconProp;
  /** The place pin before the location (icon, text or node); `false` hides it. @tr Konumun önündeki yer iğnesi (ikon, metin ya da düğüm); `false` gizler. */
  placeIcon?: IconProp;
  /** Own icon of the comment button (icon, text or node). @tr Yorum düğmesinin kendi ikonu (ikon, metin ya da düğüm). */
  commentIcon?: IconProp;
  /** Own icon of the share button (icon, text or node). @tr Paylaş düğmesinin kendi ikonu (ikon, metin ya da düğüm). */
  shareIcon?: IconProp;
  /** Own icon of the ⋯ menu button (icon, text or node). @tr ⋯ menü düğmesinin kendi ikonu (ikon, metin ya da düğüm). */
  menuIcon?: IconProp;
  /** The large heart of a double tap: default, `false` (the post is liked without it) or your own node. @tr Çift dokunuştaki büyük kalp: varsayılan, `false` (gönderi onsuz beğenilir) ya da kendi düğümün. */
  bigHeart?: unknown;
  /** Heart color while liked (default: brand-pink). @tr Beğenildiğinde kalbin rengi (varsayılan: brand-pink). */
  likeColor?: ColorToken | undefined;
  /** The "View all N comments" line. Default true. @tr "View all N comments" satırı. Varsayılan true. */
  viewAll?: boolean | undefined;
  /** Extra classes on the article. @tr Makaleye (article) eklenen ek sınıflar. */
  class?: ClassProp;
}

// an own icon (IconDef, text or node) or the built-in glyph, drawn bare
const own = (x: unknown, def: Parameters<typeof ownIcon>[1]): unknown => ownIcon(x ?? undefined, def, null);

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
  // a count button (a ghost pill Button): shown while it has a handler or a count; it stays while the number changes (it rolls)
  const counter = (mark: () => unknown, n: () => number | undefined, label: () => string, fn?: () => void): (() => Element | null) => {
    const shown = computed(() => !!fn || !!n());
    return () => (shown() ? untrack(() => h(Button, { variant: "ghost", shape: "pill", class: "m-post-act", "aria-label": label, onClick: () => fn?.(), disabled: !fn, icon: mark() },
      h(CountRoll, { value: () => n() ?? 0, hideZero: true })) as Element) : null);
  };
  const author = (): Element => {
    const a = untrack(post).author;
    return h("span", { class: "m-post-name" }, h("span", { class: "m-post-name-text" }, a.name),
      a.verified && props.verifiedIcon !== false ? h(VerifiedMark, { class: "m-post-verified", label: () => L().verified ?? t`Verified`, icon: props.verifiedIcon }) : null);
  };
  // the frame is a Card (an article, no body padding); the flat look is the same Card without its frame
  return h(Card, {
    as: "article", flush: true, plain: () => val(props.variant) === "flat",
    class: () => cx("m-post", `m-post-${val(props.variant) ?? "card"}`, val(props.class)),
    "aria-label": () => L().post?.(post().author.name) ?? t`Post by ${post().author.name}`,
  },
  h("header", { class: "m-post-head" },
    () => {
      head();
      const a = untrack(post).author;
      // who: a ListRow (avatar · name · time and place), a button when the author can be opened
      return h(ListRow, {
        class: "m-post-who", ...(props.onAuthor ? { onClick: () => props.onAuthor?.(post()) } : { as: "span" as const }),
        lead: props.avatar === false ? null : h(Avatar, { name: a.name, src: a.avatar, size: "md" }),
        title: author(),
        sub: h("span", { class: "m-post-meta" },
          props.time === false ? null : h("time", { dateTime: new Date(untrack(post).time).toISOString() }, typeof props.time === "function" ? props.time(untrack(post).time) : applyPipe("relative", untrack(post).time)),
          untrack(post).place ? h("span", { class: "m-post-place" }, props.placeIcon === false ? null : own(props.placeIcon, mapPin), untrack(post).place) : null),
      });
    },
    props.menu?.length ? h(Menu, { icon: props.menuIcon ?? moreVertical, label: () => L().options ?? t`Post options`, variant: "ghost", size: "sm", class: "m-post-more", items: props.menu, args: () => [post()] }) : null),
  () => {
    const items = media();
    if (!items?.length) return null;
    return h("div", { class: "m-post-media", ref: (x: HTMLElement) => { stage = x; } },
      h(MediaGrid, {
        items, gap: "thin",
        onOpen: (i: number, el: HTMLElement) => props.onOpenMedia?.(i, el, post()),
        onDoubleTap: val(props.doubleTapLike) === false ? undefined : doubleTap,
      }),
      props.bigHeart === false ? null : h("span", { class: "m-post-big", hidden: true, "aria-hidden": "true", ref: (x: HTMLElement) => { big = x; } }, own(props.bigHeart, heart)));
  },
  h("div", { class: "m-post-actions" },
    withColor(h(LikeButton, { liked: () => !!post().liked, count: () => post().likes, onToggle: like, label: () => L().like ?? t`Like` }), props.likeColor),
    counter(() => own(props.commentIcon, message), () => post().comments, () => L().comments?.(post().comments ?? 0) ?? t`Comments: ${post().comments ?? 0}`, props.onComment && (() => props.onComment?.(post()))),
    counter(() => own(props.shareIcon, send), () => post().shares, () => L().share?.(post().shares ?? 0) ?? t`Share: ${post().shares ?? 0}`, props.onShare && (() => props.onShare?.(post())))),
  () => {
    const [handle, text] = caption().split("\u0000") as [string, string];
    if (!text) return null;
    // folds to `clamp` lines; "more" opens it for good (the state outlives a redraw of the caption)
    return h(ClampText, {
      class: "m-post-body", lines: () => val(props.clamp) ?? 3, collapsible: false, open, onOpenChange: (v: boolean) => open.set(v), labels: { more: L().more ?? t`more` },
    }, h("b", { class: "m-post-handle" }, handle), " ", text);
  },
  () => (props.onComment && post().comments && props.viewAll !== false ? h(Button, { variant: "link", class: "m-post-all", onClick: () => props.onComment?.(post()) }, L().viewAll?.(post().comments ?? 0) ?? t`View all ${post().comments} comments`) : null)) as Element;
}
