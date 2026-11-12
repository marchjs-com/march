// Feed (hadi-march/ui): a social feed. PostCards in a VirtualList (only the posts near the viewport are in the DOM)
// inside a PullToRefresh (the feed is the scroll area). Skeleton cards while the first page loads and while the next
// page loads at the end (infinite scroll), a "N new posts" pill that brings you to the top, and an end mark.
import { signal, computed } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { arrowUp } from "../../../icons/glyphs/arrowUp.ts";
import { Skeleton } from "../../../ui/feedback.ts";
import { PullToRefresh } from "../../feedback/pull-to-refresh/index.ts";
import { VirtualList } from "../../data/virtual-list/index.ts";
import { PostCard, type Post, type PostCardProps } from "../post-card/index.ts";
import { animate } from "../../../motion/animate.ts";
import "./feed.css";

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
  class?: ClassProp;
}

/** A post-shaped placeholder: avatar, two lines, a photo, an action row. */
export function PostSkeleton(props: { media?: boolean; variant?: "card" | "flat" | undefined }): Element {
  return h("div", { class: cx("hm-feed-skel", `hm-post-${props.variant ?? "card"}`), "aria-hidden": "true" },
    h("div", { class: "hm-feed-skel-head" }, h(Skeleton, { block: true, height: "sm", class: "hm-feed-skel-av" }), h(Skeleton, { lines: 2 })),
    props.media !== false ? h(Skeleton, { block: true, height: "lg", class: "hm-feed-skel-media", colors: "brand" }) : null,
    h(Skeleton, { lines: 2, class: "hm-feed-skel-text" }));
}

/** `<Feed posts={$posts} hasMore={$more} onRefresh={reload} onLoadMore={next} onLike={like} onOpenMedia={open} />` */
export function Feed(props: FeedProps): Element {
  const more = signal(false);
  let root!: HTMLElement;
  // what the scroll area shows; the list itself is built once and follows the posts
  const state = computed((): "loading" | "empty" | "list" => (val(props.loading) ? "loading" : val(props.posts).length ? "list" : "empty"));
  const loadMore = async (): Promise<void> => {
    if (more.peek() || !props.onLoadMore || val(props.hasMore) === false) return;
    more.set(true);
    try { await props.onLoadMore(); } finally { more.set(false); }
  };
  const showNew = (): void => {
    props.onShowNew?.();
    root.querySelector<HTMLElement>(".hm-feed-scroll")?.scrollTo?.({ top: 0, behavior: "smooth" });
  };
  const variant = (): "card" | "flat" => val(props.variant) ?? "card";
  const list = (): unknown => {
    const st = state();
    if (st === "loading") return h("div", { class: "hm-feed-list", "aria-busy": "true", "aria-label": () => t`Loading posts` }, [0, 1, 2].map((i) => h(PostSkeleton, { media: i !== 1, variant: variant() })));
    if (st === "empty") return props.empty ?? h("p", { class: "hm-feed-empty" }, t`No posts yet.`);
    return h(VirtualList, {
      items: props.posts, key: (p: Post) => p.id, estimate: 520, gap: variant() === "card" ? 12 : 0, scroll: "parent" as const, label: () => val(props.label) ?? t`Feed`,
      onEndReached: () => { void loadMore(); },
      render: (p: () => Post) => h(PostCard, {
        post: p, variant: variant(), clamp: props.clamp, menu: props.menu,
        onLike: props.onLike, onComment: props.onComment, onShare: props.onShare, onOpenMedia: props.onOpenMedia, onAuthor: props.onAuthor,
      }),
      footer: () => (more() ? h("div", { class: "hm-feed-more", role: "status", "aria-label": () => t`Loading more posts` }, h(PostSkeleton, { variant: variant() }))
        : val(props.hasMore) === false ? h("p", { class: "hm-feed-end" }, h("span", { class: "hm-feed-end-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")), t`You're all caught up`) : null),
    });
  };
  const pill = (): unknown => {
    const n = val(props.newCount) ?? 0;
    if (!n) return null;
    const b = h("button", { type: "button", class: "hm-feed-new", onClick: showNew }, glyph(arrowUp), t`${n} new posts`) as HTMLElement;
    animate(b, [{ transform: "translateY(-120%) scale(.9)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1 }], { duration: 320, easing: "easeOutBack" });
    return b;
  };
  return h("div", { class: () => cx("hm-feed", `hm-feed-${variant()}`, val(props.class)), ref: (x: HTMLElement) => { root = x; } },
    h("div", { class: "hm-feed-pill" }, pill),
    h(PullToRefresh, {
      class: "hm-feed-scroll", disabled: () => !props.onRefresh || !!val(props.loading),
      onRefresh: () => props.onRefresh?.(),
    }, list));
}
