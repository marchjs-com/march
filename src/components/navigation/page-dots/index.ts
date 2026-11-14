// PageDots (hadi-march/navigation): one dot per page, the current one longer and coloured (carousels, stories,
// onboarding steps). With `onChange` (or bind:value) the dots are buttons: click, arrow keys, Home / End; without it
// they only show the position. Names, colour, size, look and the content of a dot are yours.
import "./page-dots.css";
import { untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, clamp, isRtl, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import tr from "./tr.ts";

messages("tr", tr);

export interface PageDotsProps {
  /** Number of pages. */
  count: MaybeFn<number>;
  /** Current page, 0-based. */
  value?: MaybeFn<number | undefined>;
  /** Makes the dots buttons: called with the page a dot stands for. */
  onChange?: ((index: number) => void) | undefined;
  setValue?: ((index: number) => void) | undefined;
  /** Own names: the group, a dot (`page(n)`, n from 1) and the position text of read-only dots. */
  labels?: { group?: string | undefined; page?: ((n: number) => string) | undefined; status?: ((n: number, count: number) => string) | undefined } | undefined;
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** "pill" (default: the current dot is longer) or "dot" (same size, only the colour changes). */
  variant?: MaybeFn<"pill" | "dot" | undefined>;
  orientation?: MaybeFn<"horizontal" | "vertical" | undefined>;
  /** Own content of a dot: `(index, active) => content` (numbers, thumbnails). */
  dot?: ((index: number, active: () => boolean) => unknown) | undefined;
  /** Read-only dots hidden from screen readers (the position is announced elsewhere). */
  decorative?: boolean | undefined;
  disabled?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
}

/** `<PageDots count={5} bind:value={$page} />`, `<PageDots count={steps.length} value={$active} color="brand-orange" />` (read-only) */
export function PageDots(props: PageDotsProps): Element {
  const count = (): number => Math.max(0, Math.floor(val(props.count) || 0));
  const value = (): number => clamp(val(props.value) ?? 0, 0, Math.max(0, count() - 1));
  const interactive = !!(props.onChange || props.setValue);
  const go = (i: number, root?: Element | null): void => {
    const n = clamp(i, 0, count() - 1);
    props.setValue?.(n); props.onChange?.(n);
    (root?.children[n] as HTMLElement | undefined)?.focus();
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    const root = e.currentTarget as Element, vertical = val(props.orientation) === "vertical";
    const fwd = vertical ? "ArrowDown" : isRtl(root) ? "ArrowLeft" : "ArrowRight", back = vertical ? "ArrowUp" : isRtl(root) ? "ArrowRight" : "ArrowLeft";
    const cur = untrack(value), last = untrack(count) - 1;
    const to = e.key === fwd ? cur + 1 : e.key === back ? cur - 1 : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (to == null) return;
    e.preventDefault();
    go(to, root);
  };
  const cls = (i: number): string => cx("m-page-dot", props.dot && "is-own", value() === i && "is-active");
  return h("div", {
    class: () => cx("m-page-dots", `m-page-dots-${val(props.size) ?? "md"}`, val(props.variant) === "dot" && "m-page-dots-even", val(props.orientation) === "vertical" && "m-page-dots-vertical", val(props.class)),
    role: interactive ? "group" : props.decorative ? null : "img", "aria-hidden": !interactive && props.decorative ? "true" : null,
    "aria-label": () => (interactive ? props.labels?.group ?? t`Pages` : props.decorative ? null : props.labels?.status?.(value() + 1, count()) ?? t`Page ${value() + 1} of ${count()}`),
    onKeyDown: interactive ? onKeyDown : null,
  }, () => {
    const n = count();
    return untrack(() => Array.from({ length: n }, (_, i) => {
      const own = props.dot ? props.dot(i, () => value() === i) : null;
      return interactive
        ? h("button", {
          type: "button", class: () => cls(i), "aria-label": () => props.labels?.page?.(i + 1) ?? t`Page ${i + 1}`, "aria-current": () => (value() === i ? "true" : null),
          tabindex: () => (value() === i ? "0" : "-1"), disabled: () => !!val(props.disabled), onClick: (e: MouseEvent) => go(i, (e.currentTarget as Element).parentElement),
        }, own)
        : h("span", { class: () => cls(i) }, own);
    }));
  });
}
