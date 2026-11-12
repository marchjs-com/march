// Pagination (hadi-march/ui).
import "./pagination.css";
import { computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { chevronLeft } from "../../../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { more } from "../../../icons/glyphs/more.ts";

export interface PaginationProps { page: MaybeFn<number>; pages: MaybeFn<number>; onPage?: (p: number) => void; setPage?: (p: number) => void; siblings?: number; class?: ClassProp }
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
  return h("nav", { class: () => cx("hm-pagination", val(props.class)), "aria-label": () => t`Pagination` },
    h("button", { type: "button", class: "hm-page-btn hm-page-nav", "aria-label": () => t`Previous`, disabled: () => val(props.page) <= 1, onClick: () => go(val(props.page) - 1) }, glyph(chevronLeft)),
    () => items().map((it) => untrack(() => (it === "…"
      ? h("span", { class: "hm-page-gap", "aria-hidden": "true" }, glyph(more))
      : h("button", { type: "button", class: () => cx("hm-page-btn", val(props.page) === it && "is-active"), "aria-current": () => (val(props.page) === it ? "page" : null), onClick: () => go(it) }, String(it))))),
    h("button", { type: "button", class: "hm-page-btn hm-page-nav", "aria-label": () => t`Next`, disabled: () => val(props.page) >= val(props.pages), onClick: () => go(val(props.page) + 1) }, glyph(chevronRight)));
}
