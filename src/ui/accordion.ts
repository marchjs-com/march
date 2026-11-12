// Accordion (hadi-march/ui).
import "./accordion.css";
import { signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { val, cx, uid, icon, glyph, type ClassProp } from "./util.ts";
import { chevronDown } from "../icons/glyphs/chevronDown.ts";
import { roving } from "./focus.ts";

export interface AccordionItem { id?: string; title: unknown; subtitle?: unknown; icon?: unknown; content: unknown; disabled?: boolean }
export interface AccordionProps { items: readonly AccordionItem[]; multiple?: boolean; open?: readonly (string | number)[]; variant?: "separated" | "contained"; class?: ClassProp }
/** `<Accordion items={[{ title: "Shipping", content: … }]} multiple />` — animated height, ↑ ↓ Home End between headers. */
export function Accordion(props: AccordionProps): Element {
  const keyOf = (it: AccordionItem, i: number): string | number => it.id ?? i;
  const open = signal(new Set<string | number>(props.open ?? []));
  const base = uid("hm-acc");
  const toggle = (k: string | number): void => { open.update((s) => { const n = props.multiple ? new Set(s) : new Set<string | number>(); if (s.has(k)) n.delete(k); else n.add(k); return n; }); };
  const nav = (e: KeyboardEvent): void => {
    const btns = [...((e.currentTarget as HTMLElement).closest(".hm-accordion")?.querySelectorAll<HTMLButtonElement>(".hm-acc-btn:not(:disabled)") ?? [])];
    if (btns.includes(e.target as HTMLButtonElement)) roving(e, btns); // ↑ ↓ Home End, wrapping (each header stays a Tab stop)
  };
  return h("div", { class: () => cx("hm-accordion", `hm-accordion-${props.variant ?? "separated"}`, val(props.class)), onKeydown: nav },
    props.items.map((it, i) => {
      const k = keyOf(it, i), isOpen = (): boolean => open().has(k), id = `${base}-${i}`;
      return h("div", { class: () => cx("hm-acc-item", isOpen() && "is-open") },
        h("h3", { class: "hm-acc-head" },
          h("button", { type: "button", class: "hm-acc-btn", id: `${id}-b`, "aria-expanded": () => String(isOpen()), "aria-controls": `${id}-p`, disabled: it.disabled, onClick: () => toggle(k) },
            icon(it.icon, "hm-acc-icon"),
            h("span", { class: "hm-acc-titles" }, h("span", { class: "hm-acc-title" }, it.title), it.subtitle != null && h("span", { class: "hm-acc-sub" }, it.subtitle)),
            h("span", { class: "hm-acc-chev", "aria-hidden": "true" }, glyph(chevronDown)))),
        h("div", { class: "hm-acc-panel", id: `${id}-p`, role: "region", "aria-labelledby": `${id}-b`, inert: () => !isOpen() },
          h("div", { class: "hm-acc-inner" }, h("div", { class: "hm-acc-body" }, it.content))));
    }));
}
