# Feed

A social feed. PostCards sit in a VirtualList, so only the posts near the viewport are in the DOM, inside a
PullToRefresh (the feed is the scroll area; keyboard users get a Refresh button). The first page shows skeleton posts;
reaching the end loads the next page with a skeleton at the bottom (infinite scroll) and an end mark once there is
nothing more. New posts waiting above show a "N new posts" pill that merges them and scrolls to the top.

```tsx
<Feed posts={$posts} hasMore={$more} onRefresh={reload} onLoadMore={next} onLike={like} onOpenMedia={open} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `posts` | `Post[]` / accessor | — | see PostCard |
| `loading` | boolean | false | first page: skeleton posts |
| `hasMore` | boolean | — | `false` shows the end mark and stops loading |
| `onRefresh` | `() => Promise` | — | pull to refresh; without it pulling is off |
| `onLoadMore` | `() => Promise` | — | runs once per page near the end |
| `newCount` / `onShowNew` | number / `() => void` | — | the "N new posts" pill |
| `variant` | `card` `flat` | `card` | |
| `empty` | node | "No posts yet." | |
| `onLike` `onComment` `onShare` `onOpenMedia` `onAuthor` `menu` `clamp` | | | passed to every PostCard |

`PostSkeleton` is the post-shaped placeholder on its own.

## Accessibility

The posts are a list ("Feed") whose items announce their position in the whole feed. Loading states are `aria-busy`
and a status ("Loading more posts"); the pill is a button. Pull to refresh announces its state in a live region.

## Composed of

PullToRefresh, VirtualList, PostCard, Skeleton.
