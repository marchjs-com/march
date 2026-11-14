// The spinner's ring alone: one element and its classes; no text, no colour lists. Spinner and Button draw this one.
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn } from "../../../ui/util.ts";

/**
 * The turning ring. `size`: "sm" | "md" | "lg", or "em" (the size and the colour of the text around it).
 * Without `attrs` it is decorative (`aria-hidden`); give `role` / `aria-label` to name it.
 */
export function spinnerRing(size?: MaybeFn<string | null | undefined>, cls?: MaybeFn<unknown>, attrs?: Record<string, unknown>): HTMLElement {
  return h("span", { class: () => { const s = val(size); return cx("m-loading", s && `m-spin-${s}`, val(cls)); }, ...(attrs ?? { "aria-hidden": "true" }) }) as HTMLElement;
}
