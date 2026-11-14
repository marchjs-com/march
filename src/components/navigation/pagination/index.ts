// Pagination (hadi-march/ui).
import "./pagination.css";
import { computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { chevronLeft } from "../../../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { more } from "../../../icons/glyphs/more.ts";

export interface PaginationProps {
  page: MaybeFn<number>;
  pages: MaybeFn<number>;
  onPage?: (p: number) => void;
  setPage?: (p: number) => void;
  siblings?: number;
  /** Accessible name of the nav (default "Pagination"). */
  label?: MaybeFn<string | undefined>;
  /** Accessible names: the Previous / Next buttons, and `page(n)` for a page button (default: the number). */
  labels?: { previous?: MaybeFn<string | undefined>; next?: MaybeFn<string | undefined>; page?: ((n: number) => string) | undefined } | undefined;
  /** The Previous / Next buttons (default true). */
  controls?: boolean | undefined;
  /** Content of the Previous button: an icon or a short text (default: a chevron). */
  prev?: unknown;
  /** Content of the Next button: an icon or a short text (default: a chevron). */
  next?: unknown;
  /** The mark where pages are left out: the dots (default), your own icon or short text, or false for none. */
  gap?: unknown;
  /** Theme color token of the current page (default: neutral). */
  color?: ColorToken | undefined;
  class?: ClassProp;
}
/** Numbered pages with ellipses: `<Pagination bind:page={$page} pages={20} />` (1-based). */
export function Pagination(props: PaginationProps): Element {
  const go = (p: number): void => { props.onPage?.(p); props.setPage?.(p); };
  const items = computed((): (number | "…")[] => {
    const p = val(props.page), n = Math.max(1, val(props.pages)), s = props.siblings ?? 1;
    const out: (number | "…")[] = [];
    for (let i = 1; i <= n; i++) {
      if (i === 1 || i === n || Math.abs(i - p) <= s || (p <= 3 + s && i <= 3 + 2 * s) || (p >= n - 2 - s && i >= n - 2 - 2 * s)) out.push(i);
      else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  });
  const controls = props.controls !== false, pageName = props.labels?.page;
  const own = (x: unknown, fallback: Parameters<typeof glyph>[0]): unknown => (x == null || x === true ? glyph(fallback) : icon(x, "hm-page-own"));
  return h("nav", { class: () => cx("hm-pagination", val(props.class)), "aria-label": () => val(props.label) ?? t`Pagination`, "data-hm-color": () => colorAttr(props.color) },
    controls && h("button", { type: "button", class: "hm-page-btn hm-page-nav hm-page-prev", "aria-label": () => val(props.labels?.previous) ?? t`Previous`, disabled: () => val(props.page) <= 1, onClick: () => go(val(props.page) - 1) }, own(props.prev, chevronLeft)),
    () => items().map((it) => untrack(() => (it === "…"
      ? props.gap !== false && h("span", { class: "hm-page-gap", "aria-hidden": "true" }, own(props.gap, more))
      : h("button", { type: "button", class: () => cx("hm-page-btn", val(props.page) === it && "is-active"), "aria-current": () => (val(props.page) === it ? "page" : null),
        "aria-label": pageName ? pageName(it) : null, onClick: () => go(it) }, String(it))))),
    controls && h("button", { type: "button", class: "hm-page-btn hm-page-nav hm-page-next", "aria-label": () => val(props.labels?.next) ?? t`Next`, disabled: () => val(props.page) >= val(props.pages), onClick: () => go(val(props.page) + 1) }, own(props.next, chevronRight)));
}
