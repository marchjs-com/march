// Faq (hadi-march/landing): frequently asked questions as an Accordion. `split` puts the heading and a contact line at
// the start and the questions at the end; `search` adds a SearchBox that narrows the list with the shared fuzzy ranking
// (accent- and case-insensitive, typo tolerant) and says how many questions match.
import "./faq.css";
import { h } from "../../../dom/h.ts";
import { signal, computed } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Accordion } from "../../../ui/accordion.ts";
import { SearchBox } from "../../../ui/layout.ts";
import { rank } from "../../../ui/fold.ts";
import { Reveal } from "../reveal/index.ts";

export interface FaqItem { q: string; a: unknown; /** Extra words for search. */ keywords?: string | undefined }
export interface FaqProps {
  items: readonly FaqItem[];
  layout?: "center" | "split" | undefined;
  /** split: heading, lead and a contact line beside the questions. */
  title?: MaybeFn<unknown> | undefined;
  lead?: MaybeFn<unknown> | undefined;
  contact?: unknown;
  /** Search box above the questions. */
  search?: boolean | undefined;
  /** Several open at once (default false). */
  multiple?: boolean | undefined;
  class?: ClassProp | undefined;
}

/** `<Faq items={[{ q: "Is it free?", a: "Yes, MIT." }]} layout="split" title="Questions" search />` */
export function Faq(props: FaqProps): Element {
  const q = signal("");
  const shown = computed(() => {
    const s = q().trim();
    return s ? rank(s, props.items, (x) => ({ title: x.q, keywords: [x.keywords ?? "", typeof x.a === "string" ? x.a : ""] })).map((r) => r.item) : props.items;
  });
  const list = h("div", { class: "hm-faq-list" },
    props.search ? h("div", { class: "hm-faq-search" },
      h(SearchBox, { value: q, debounce: 120, placeholder: t`Search questions`, "aria-label": t`Search questions` }),
      h("p", { class: "hm-faq-count", "aria-live": "polite" }, () => (q().trim() ? t`${shown().length} of ${props.items.length} questions` : ""))) : null,
    () => {
      const items = shown();
      if (!items.length) return h("p", { class: "hm-faq-empty" }, t`No question matches. Try other words.`);
      return h(Accordion, { variant: "separated", multiple: !!props.multiple, items: items.map((x) => ({ id: x.q, title: x.q, content: x.a })) });
    });
  const split = props.layout === "split";
  return h("div", { class: cx("hm-faq", split && "hm-faq-split", val(props.class)) },
    split ? h(Reveal, { class: "hm-faq-aside", effect: "up", stagger: 80 },
      props.title != null && h("h2", { class: "hm-faq-title" }, () => val(props.title)),
      props.lead != null && h("p", { class: "hm-faq-lead" }, () => val(props.lead)),
      props.contact != null && h("div", { class: "hm-faq-contact" }, props.contact)) : null,
    list) as Element;
}
