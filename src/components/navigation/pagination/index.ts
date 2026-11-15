// Pagination (march/ui): numbered pages, or `variant="simple"` (Previous / Next, with or without a page count).
import "./pagination.css";
import { computed, untrack, reactive } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import type { IconDef } from "../../../icons/svg.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Select } from "../../forms/select/index.ts";
import { chevronLeft } from "../../../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { more } from "../../../icons/glyphs/more.ts";

// a live prop for h(Component, …): it becomes a getter
const live = reactive as <T>(fn: () => T) => T;

/** The rows on the current page, for the `info` text of the simple variant. */
export interface PageRange { from: number; to: number; total: number }

export interface PaginationProps {
  /** Current page, 1-based (not needed in cursor mode). @tr Geçerli sayfa, 1'den başlar (imleç modunda gerekmez). */
  page?: MaybeFn<number | null | undefined>;
  /** Page count; or give `total` (+ `size`) and it is worked out. @tr Sayfa sayısı; ya da `total` (+ `size`) ver, hesaplanır. */
  pages?: MaybeFn<number | null | undefined>;
  /** Called with the chosen page. @tr Seçilen sayfayla çağrılır. */
  onPage?: (p: number) => void;
  /** Called with the chosen page like `onPage` (`bind:page` uses it). @tr `onPage` gibi seçilen sayfayla çağrılır (`bind:page` bunu kullanır). */
  setPage?: (p: number) => void;
  /** Pages shown on each side of the current one (default 1). @tr Geçerli sayfanın her iki yanında gösterilen sayfa sayısı (varsayılan 1). */
  siblings?: number;
  /** "numbers" (default): numbered pages with ellipses; "simple": Previous / Next only (the page count may be unknown). @tr "numbers" (varsayılan): üç noktalı numaralı sayfalar; "simple": yalnız Previous / Next (sayfa sayısı bilinmeyebilir). */
  variant?: "numbers" | "simple" | undefined;
  /** Row count: gives the page count (with `size`) and the "1–20 of 134" text of the simple variant. @tr Satır sayısı: sayfa sayısını (`size` ile) ve simple görünümün "1–20 of 134" metnini verir. */
  total?: MaybeFn<number | null | undefined>;
  /** Rows per page (default 20). @tr Sayfa başına satır (varsayılan 20). */
  size?: MaybeFn<number | null | undefined>;
  /** Simple variant: the choices of a "rows per page" select. @tr Simple görünüm: "sayfa başına satır" seçicisinin seçenekleri. */
  sizes?: readonly number[] | undefined;
  /** Called with the new size from the rows-per-page select. @tr Sayfa başına satır seçicisinde yeni boyutla çağrılır. */
  onSize?: ((size: number) => void) | undefined;
  /** Cursor mode (simple variant, no page count): whether there is a previous / next page. @tr İmleç modu (simple görünüm, sayfa sayısı yok): önceki sayfa var mı. */
  hasPrev?: MaybeFn<boolean | null | undefined>;
  /** Cursor mode: whether there is a next page. @tr İmleç modu: sonraki sayfa var mı. */
  hasNext?: MaybeFn<boolean | null | undefined>;
  /** Cursor mode: called instead of `onPage`. @tr İmleç modu: `onPage` yerine çağrılır (önceki sayfa). */
  onPrev?: (() => void) | undefined;
  /** Cursor mode: called instead of `onPage` for the next page. @tr İmleç modu: sonraki sayfa için `onPage` yerine çağrılır. */
  onNext?: (() => void) | undefined;
  /** Simple variant: the "1–20 of 134" text (shown when `total` is given). false: none; a function: your own text. @tr Simple görünüm: "1–20 of 134" metni (`total` verilince gösterilir). false: yok; fonksiyon: kendi metnin. */
  info?: boolean | ((range: PageRange) => unknown) | undefined;
  /** Simple variant: the "Page 2 of 7" text between the buttons (shown when the page count is known). false: none; a function: your own text. @tr Simple görünüm: düğmeler arasındaki "Page 2 of 7" metni (sayfa sayısı biliniyorsa gösterilir). false: yok; fonksiyon: kendi metnin. */
  status?: boolean | ((page: number, pages: number) => unknown) | undefined;
  /** Accessible name of the nav (default "Pagination"). @tr nav öğesinin erişilebilir adı (varsayılan "Pagination"). */
  label?: MaybeFn<string | undefined>;
  /** Accessible names: the Previous / Next buttons, `page(n)` for a page button (default: the number), the rows-per-page select. @tr Erişilebilir adlar: Previous / Next düğmeleri, sayfa düğmesi için `page(n)` (varsayılan: sayı), sayfa başına satır seçicisi. */
  labels?: { previous?: MaybeFn<string | undefined>; next?: MaybeFn<string | undefined>; page?: ((n: number) => string) | undefined; sizes?: MaybeFn<string | undefined> } | undefined;
  /** The Previous / Next buttons (default true). @tr Previous / Next düğmeleri (varsayılan true). */
  controls?: boolean | undefined;
  /** Content of the Previous button: an icon or a short text (default: a chevron; simple: a chevron and "Previous"). @tr Previous düğmesinin içeriği: ikon ya da kısa metin (varsayılan: bir ok; simple: ok ve "Previous"). */
  prev?: unknown;
  /** Content of the Next button: an icon or a short text (default: a chevron; simple: "Next" and a chevron). @tr Next düğmesinin içeriği: ikon ya da kısa metin (varsayılan: bir ok; simple: "Next" ve ok). */
  next?: unknown;
  /** The mark where pages are left out: the dots (default), your own icon or short text, or false for none. @tr Atlanan sayfaların işareti: noktalar (varsayılan), kendi ikonun ya da kısa metin, ya da hiçbiri için false. */
  gap?: unknown;
  /** Extra class on the nav. @tr nav öğesine eklenen sınıf. */
  class?: ClassProp;
}
/**
 * Numbered pages with ellipses: `<Pagination bind:page={$page} pages={20} />` (1-based). `variant="simple"` draws only
 * Previous / Next: with a page count (`pages`, or `total` + `size`) or in cursor mode (`hasPrev`, `hasNext`, `onPrev`, `onNext`).
 */
export function Pagination(props: PaginationProps): Element {
  const go = (p: number): void => { props.onPage?.(p); props.setPage?.(p); };
  const page = (): number => Number(val(props.page) ?? 1), size = (): number => Number(val(props.size) ?? 20);
  const total = (): number | null => { const n = val(props.total); return n == null ? null : Number(n); };
  // null: the page count is not known (cursor mode)
  const pages = (): number | null => { const n = val(props.pages), all = total(); return n != null ? Math.max(1, Number(n)) : all != null ? Math.max(1, Math.ceil(all / size())) : null; };
  const noPrev = (): boolean => { const has = val(props.hasPrev); return has != null ? !has : page() <= 1; };
  const noNext = (): boolean => { const has = val(props.hasNext), n = pages(); return has != null ? !has : n != null && page() >= n; };
  const back = (): void => (props.onPrev ? props.onPrev() : go(page() - 1)), forth = (): void => (props.onNext ? props.onNext() : go(page() + 1));
  const prevName = (): string => val(props.labels?.previous) ?? t`Previous`, nextName = (): string => val(props.labels?.next) ?? t`Next`;
  const controls = props.controls !== false, pageName = props.labels?.page;
  const own = (x: unknown, fallback: IconDef): unknown => ownIcon(x ?? undefined, fallback, "m-page-own");
  const arrow = (dir: "prev" | "next", content: unknown, fallback: IconDef, off: () => boolean, name: () => string, act: () => void): unknown =>
    h(IconButton, { class: `m-page-nav m-page-${dir}`, label: name, title: false, disabled: off, onClick: act, icon: own(content, fallback) });
  const attrs = { class: () => cx("m-pagination", props.variant === "simple" && "m-pagination-simple", val(props.class)), "aria-label": () => val(props.label) ?? t`Pagination` };

  if (props.variant === "simple") {
    const nf = (n: number): string => n.toLocaleString();
    const info = props.info, status = props.status;
    const step = (dir: "prev" | "next", content: unknown, off: () => boolean, name: () => string, act: () => void): unknown => h(Button, {
      variant: "secondary", size: "sm", class: `m-page-nav m-page-${dir}`, disabled: off, onClick: act,
      // the default content already says "Previous" / "Next"; your own content gets the accessible name
      "aria-label": () => (content == null || content === true ? null : name()),
    }, content == null || content === true ? (dir === "prev" ? [glyph(chevronLeft), name] : [name, glyph(chevronRight)]) : icon(content, "m-page-own"));
    return h("nav", attrs,
      info !== false && h("span", { class: "m-page-info", "aria-live": "polite" }, () => {
        const n = total();
        if (n == null) return null;
        const range: PageRange = { from: n ? (page() - 1) * size() + 1 : 0, to: Math.min(n, page() * size()), total: n };
        if (typeof info === "function") return info(range);
        return n ? t`${nf(range.from)}–${nf(range.to)} of ${nf(n)}` : t`No results`;
      }),
      props.sizes && h(Select, { class: "m-select-sm m-page-sizes", options: props.sizes, value: live(size), onChange: (v: number | null) => { if (v != null) props.onSize?.(v); }, "aria-label": live(() => val(props.labels?.sizes) ?? t`Rows per page`) }),
      h("div", { class: "m-page-steps" },
        controls && step("prev", props.prev, noPrev, prevName, back),
        status !== false && (() => {
          const n = pages();
          return n == null ? null : h("span", { class: "m-page-status" }, typeof status === "function" ? status(page(), n) : t`Page ${page()} of ${n}`);
        }),
        controls && step("next", props.next, noNext, nextName, forth)));
  }

  const items = computed((): (number | "…")[] => {
    const p = page(), n = pages() ?? 1, s = props.siblings ?? 1;
    const out: (number | "…")[] = [];
    for (let i = 1; i <= n; i++) {
      if (i === 1 || i === n || Math.abs(i - p) <= s || (p <= 3 + s && i <= 3 + 2 * s) || (p >= n - 2 - s && i >= n - 2 - 2 * s)) out.push(i);
      else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  });
  return h("nav", attrs,
    controls && arrow("prev", props.prev, chevronLeft, noPrev, prevName, back),
    () => items().map((it) => untrack(() => (it === "…"
      ? props.gap !== false && h("span", { class: "m-page-gap", "aria-hidden": "true" }, own(props.gap, more))
      : h("button", { type: "button", class: () => cx("m-page-btn", page() === it && "is-active"), "aria-current": () => (page() === it ? "page" : null),
        "aria-label": pageName ? pageName(it) : null, onClick: () => go(it) }, String(it))))),
    controls && arrow("next", props.next, chevronRight, noNext, nextName, forth));
}
