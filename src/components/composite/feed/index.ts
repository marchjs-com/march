// Feed (hadi-march/ui): a social feed. PostCards in a VirtualList (only the posts near the viewport are in the DOM)
// inside a PullToRefresh (the feed is the scroll area). Skeleton cards while the first page loads and while the next
// page loads at the end (infinite scroll), a "N new posts" pill that brings you to the top, and an end mark.
import { signal, computed } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { arrowUp } from "../../../icons/glyphs/arrowUp.ts";
import { Skeleton } from "../../../ui/feedback.ts";
import { PullToRefresh } from "../../feedback/pull-to-refresh/index.ts";
import { VirtualList } from "../../data/virtual-list/index.ts";
import { PostCard, type Post, type PostCardProps } from "../post-card/index.ts";
import { BRAND_COLORS, type ColorToken } from "../../../theme/colors.ts";
import { Button } from "../../actions/button/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { animate } from "../../../motion/animate.ts";
import "./feed.css";

/** The texts Feed writes itself; every one is optional (default: the built-in text). */
export interface FeedLabels {
  loading?: string; loadingMore?: string; empty?: string; end?: string;
  /** Text of the new-posts pill. */
  newPosts?: (count: number) => string;
}

export interface FeedProps extends Pick<PostCardProps, "onLike" | "onComment" | "onShare" | "onOpenMedia" | "onAuthor" | "menu" | "clamp"> {
  posts: MaybeFn<readonly Post[]>;
  /** First page is loading: skeleton cards. */
  loading?: MaybeFn<boolean | undefined>;
  /** More pages exist (infinite scroll). */
  hasMore?: MaybeFn<boolean | undefined>;
  /** Pull to refresh (and the keyboard Refresh button). */
  onRefresh?: (() => unknown) | undefined;
  /** Next page; skeleton cards show at the end until it settles. */
  onLoadMore?: (() => unknown) | undefined;
  /** New posts waiting above: shows the "N new posts" pill. */
  newCount?: MaybeFn<number | undefined>;
  /** The pill was pressed (merge the new posts); the feed scrolls to the top. */
  onShowNew?: (() => void) | undefined;
  /** card: framed posts with space · flat: edge to edge with dividers. Default card. */
  variant?: MaybeFn<"card" | "flat" | undefined>;
  /** Shown when there are no posts and nothing loads. */
  empty?: unknown;
  label?: MaybeFn<string | undefined>;
  /** Own texts (loading names, empty and end texts, the pill). */
  labels?: MaybeFn<FeedLabels | undefined>;
  /** The end mark: true (default: four dots and a text), false, or your own content. */
  end?: unknown;
  /** The new-posts pill: true (default), false, or `(count) => content`. */
  newPill?: boolean | ((count: number) => unknown) | undefined;
  /** Color of the pill (default: Aktivite blue). */
  newColor?: ColorToken | undefined;
  /** Skeleton posts while the first page loads. Default 3. */
  skeletons?: number | undefined;
  /** Draw a post yourself instead of the PostCard: `(post) => node` (`post` is an accessor). */
  renderPost?: ((post: () => Post) => unknown) | undefined;
  /** More PostCard props for every post (labels, icons, avatar, time …). */
  postProps?: Partial<Omit<PostCardProps, "post">> | undefined;
  /** Motion of the pill. Default true. */
  motion?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
}

/** A post-shaped placeholder: avatar, two lines, a photo, an action row. */
export function PostSkeleton(props: { media?: boolean; variant?: "card" | "flat" | undefined }): Element {
  return h("div", { class: cx("m-feed-skel", `m-post-${props.variant ?? "card"}`), "aria-hidden": "true" },
    h("div", { class: "m-feed-skel-head" }, h(Skeleton, { shape: "circle", class: "m-feed-skel-av" }), h(Skeleton, { lines: 2 })),
    props.media !== false ? h(Skeleton, { block: true, height: "lg", class: "m-feed-skel-media", colors: "brand" }) : null,
    h(Skeleton, { lines: 2, class: "m-feed-skel-text" }));
}

/** `<Feed posts={$posts} hasMore={$more} onRefresh={reload} onLoadMore={next} onLike={like} onOpenMedia={open} />` */
export function Feed(props: FeedProps): Element {
  const more = signal(false);
  let root!: HTMLElement;
  const L = (): FeedLabels => val(props.labels) ?? {};
  const renderPost = props.renderPost, newPill = props.newPill;
  // what the scroll area shows; the list itself is built once and follows the posts
  const state = computed((): "loading" | "empty" | "list" => (val(props.loading) ? "loading" : val(props.posts).length ? "list" : "empty"));
  const loadMore = async (): Promise<void> => {
    if (more.peek() || !props.onLoadMore || val(props.hasMore) === false) return;
    more.set(true);
    try { await props.onLoadMore(); } finally { more.set(false); }
  };
  const showNew = (): void => {
    props.onShowNew?.();
    root.querySelector<HTMLElement>(".m-feed-scroll")?.scrollTo?.({ top: 0, behavior: "smooth" });
  };
  const variant = (): "card" | "flat" => val(props.variant) ?? "card";
  const list = (): unknown => {
    const st = state();
    if (st === "loading") return h("div", { class: "m-feed-list", "aria-busy": "true", "aria-label": () => L().loading ?? t`Loading posts` }, Array.from({ length: props.skeletons ?? 3 }, (_, i) => h(PostSkeleton, { media: i !== 1, variant: variant() })));
    if (st === "empty") return props.empty ?? h(Empty, { size: "sm", class: "m-feed-empty", title: L().empty ?? t`No posts yet.` });
    return h(VirtualList, {
      items: props.posts, key: (p: Post) => p.id, estimate: 520, gap: variant() === "card" ? 12 : 0, scroll: "parent" as const, label: () => val(props.label) ?? t`Feed`,
      onEndReached: () => { void loadMore(); },
      render: (p: () => Post) => renderPost ? renderPost(p) : h(PostCard, {
        ...props.postProps, post: p, variant: variant(), clamp: props.clamp, menu: props.menu,
        onLike: props.onLike, onComment: props.onComment, onShare: props.onShare, onOpenMedia: props.onOpenMedia, onAuthor: props.onAuthor,
      }),
      footer: () => { const end = props.end; return (more() ? h("div", { class: "m-feed-more", role: "status", "aria-label": () => L().loadingMore ?? t`Loading more posts` }, h(PostSkeleton, { variant: variant() }))
        : val(props.hasMore) !== false || end === false ? null
        : end != null && end !== true ? h("div", { class: "m-feed-end" }, end)
        : h("p", { class: "m-feed-end" }, h("span", { class: "m-feed-end-dots", "aria-hidden": "true" }, BRAND_COLORS.map((color) => h(StatusDot, { color }))), L().end ?? t`You're all caught up`)); },
    });
  };
  const pill = (): unknown => {
    const n = val(props.newCount) ?? 0;
    if (!n || newPill === false) return null;
    // a pill Button floating over the top of the feed
    const b = h(Button, { variant: "primary", shape: "pill", color: props.newColor ?? "brand-blue", class: "m-feed-new", icon: typeof newPill === "function" ? null : arrowUp, onClick: showNew },
      typeof newPill === "function" ? newPill(n) : L().newPosts?.(n) ?? t`${n} new posts`) as HTMLElement;
    if (val(props.motion) !== false) animate(b, [{ transform: "translateY(-120%) scale(.9)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1 }], { duration: 320, easing: "easeOutBack" });
    return b;
  };
  return h("div", { class: () => cx("m-feed", `m-feed-${variant()}`, val(props.class)), ref: (x: HTMLElement) => { root = x; } },
    h("div", { class: "m-feed-pill" }, pill),
    h(PullToRefresh, {
      class: "m-feed-scroll", disabled: () => !props.onRefresh || !!val(props.loading),
      onRefresh: () => props.onRefresh?.(),
    }, list));
}
