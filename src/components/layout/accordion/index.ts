// Accordion (hadi-march/ui).
import "./accordion.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { val, cx, uid, type ClassProp } from "../../../ui/util.ts";
import { Chevron } from "../../actions/chevron/index.ts";
import { PlainListRow } from "../../data/list-row/core.ts";
import { roving } from "../../../ui/focus.ts";
import { type ColorToken } from "../../../theme/colors.ts";

export interface AccordionItem { id?: string; title: unknown; subtitle?: unknown; icon?: unknown; content: unknown; disabled?: boolean }
export interface AccordionProps {
  items: readonly AccordionItem[];
  multiple?: boolean;
  open?: readonly (string | number)[];
  variant?: "separated" | "contained";
  /** The arrow at the end of a header: true (default), false, an icon / text, or `(open, item) => node` (open is live). */
  chevron?: boolean | unknown | ((open: () => boolean, item: AccordionItem) => unknown);
  /** false: panels open and close at once, the arrow does not turn (default true). */
  animated?: boolean;
  /** Called when a section opens or closes. */
  onToggle?: (key: string | number, open: boolean) => void;
  class?: ClassProp;
}
/** `<Accordion items={[{ title: "Shipping", content: … }]} multiple />` — animated height, ↑ ↓ Home End between headers. */
export function Accordion(props: AccordionProps): Element {
  const keyOf = (it: AccordionItem, i: number): string | number => it.id ?? i;
  const open = signal(new Set<string | number>(props.open ?? []));
  const base = uid("m-acc");
  const toggle = (k: string | number): void => { open.update((s) => { const n = props.multiple ? new Set(s) : new Set<string | number>(); if (s.has(k)) n.delete(k); else n.add(k); return n; }); props.onToggle?.(k, open.peek().has(k)); };
  const nav = (e: KeyboardEvent): void => {
    const btns = [...((e.currentTarget as HTMLElement).closest(".m-accordion")?.querySelectorAll<HTMLButtonElement>(".m-acc-btn:not(:disabled)") ?? [])];
    if (btns.includes(e.target as HTMLButtonElement)) roving(e, btns); // ↑ ↓ Home End, wrapping (each header stays a Tab stop)
  };
  const chev = (isOpen: () => boolean, it: AccordionItem): unknown => {
    const c = props.chevron;
    if (c === false) return null;
    const own = typeof c === "function" ? (c as (open: () => boolean, item: AccordionItem) => unknown)(isOpen, it) : c;
    const mine = own != null && own !== true;
    // follows the header button's aria-expanded; an own mark is drawn as given and turns half way round
    return h(Chevron, { direction: "down", size: "md", class: cx("m-acc-chev", mine && "is-own"), motion: props.animated === false ? false : undefined, icon: mine ? own : undefined });
  };
  return h("div", { class: () => cx("m-accordion", `m-accordion-${props.variant ?? "separated"}`, props.animated === false && "is-static", val(props.class)), onKeydown: nav },
    props.items.map((it, i) => {
      const k = keyOf(it, i), isOpen = (): boolean => open().has(k), id = `${base}-${i}`;
      return h("div", { class: () => cx("m-acc-item", isOpen() && "is-open") },
        h("h3", { class: "m-acc-head" },
          // the header is a ListRow button (the plain one: titles wrap, no scrolling text is loaded)
          h(PlainListRow, { class: "m-acc-btn", id: `${id}-b`, "aria-expanded": () => String(isOpen()), "aria-controls": `${id}-p`, disabled: it.disabled, onClick: () => toggle(k), overflow: "wrap",
            lead: it.icon, title: h("span", { class: "m-acc-title" }, it.title), sub: it.subtitle, trail: chev(isOpen, it) })),
        h("div", { class: "m-acc-panel", id: `${id}-p`, role: "region", "aria-labelledby": `${id}-b`, inert: () => !isOpen() },
          h("div", { class: "m-acc-inner" }, h("div", { class: "m-acc-body" }, it.content))));
    }));
}
