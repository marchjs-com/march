# Pagination

Numbered pages with ellipses: the first and last pages, the current page and `siblings` pages on each side stay
visible, the rest collapse into a gap. Previous / Next buttons are disabled at the ends. Pages are 1-based.
`variant="simple"` draws only Previous / Next, with a page count or without one (cursor mode).

```tsx
<Pagination bind:page={$page} pages={20} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `page` | number / accessor | `1` | current page (1-based) |
| `pages` | number / accessor | from `total` | page count; or give `total` (+ `size`) |
| `variant` | `"numbers"` `"simple"` | `"numbers"` | `"simple"`: Previous / Next only, the page count may be unknown |
| `total`, `size` | number / accessor | —, `20` | row count and rows per page: the page count, and the range text of the simple variant |
| `sizes`, `onSize` | number[], `(size) => void` | — | simple: a "rows per page" select |
| `hasPrev`, `hasNext` | boolean / accessor | — | cursor mode: whether a previous / next page exists (no page count needed) |
| `onPrev`, `onNext` | `() => void` | — | cursor mode: called instead of `onPage` |
| `info` | boolean / `({ from, to, total }) => node` | shown with `total` | simple: the "21–40 of 134" text; `false`: none |
| `status` | boolean / `(page, pages) => node` | shown with a page count | simple: the "Page 2 of 7" text between the buttons; `false`: none |
| `onPage` / `setPage` | `(p) => void` | — | called with the chosen page (`bind:page` works) |
| `siblings` | number | `1` | pages shown on each side of the current one |
| `controls` | boolean | `true` | the Previous / Next buttons |
| `prev` / `next` | icon / short text | chevrons | content of the Previous / Next buttons |
| `gap` | icon / short text / `false` | dots | the mark where pages are left out; `false`: no mark |
| `color` | ColorToken | neutral | colour of the current page |
| `label` | string | "Pagination" | accessible name of the nav |
| `labels` | `{ previous?, next?, page?: (n) => string, sizes? }` | "Previous", "Next", the number, "Rows per page" | accessible names of the buttons and the select |
| `class` | ClassProp | — | extra class on the nav |

```tsx
<Pagination bind:page={$page} pages={20} prev="‹ Back" next="More ›" gap="·" color="brand-blue"
  label="Result pages" labels={{ previous: "Previous page", next: "Next page", page: (n) => `Page ${n}` }} />
<Pagination bind:page={$page} pages={5} controls={false} />          // numbers only
<Pagination variant="simple" bind:page={$page} total={134} size={$size} sizes={[20, 50]} onSize={(n) => $size = n} />
<Pagination variant="simple" hasPrev={$before != null} hasNext={$after != null} onPrev={older} onNext={newer} />   // cursor mode
<Pagination variant="simple" bind:page={$slide} pages={12} status={(p, n) => `${p} / ${n}`} prev={arrowLeft} next={arrowRight} />
```

## Accessibility

A `<nav>` named "Pagination"; the current page has `aria-current="page"`; Previous / Next have accessible names and are
disabled at the ends; the ellipsis is hidden from assistive technology. Simple variant: the default buttons carry their
text ("Previous", "Next"), your own content gets the accessible name, and the range text is a polite live region.

## Composed of

Button and Select (the simple variant: Previous / Next and the rows-per-page select); the numbered pages are plain buttons.
