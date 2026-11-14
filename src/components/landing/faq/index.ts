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
import { Empty } from "../../feedback/empty/index.ts";
import type { RevealOptions } from "../reveal/index.ts";
import { SectionHead } from "../section-head/index.ts";

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
  /** Every text the block writes itself; the defaults are translated. `count` gets the shown and the total number. */
  labels?: {
    /** Placeholder and accessible name of the search box (default "Search questions"). */
    search?: string;
    count?: (shown: number, total: number) => unknown;
    /** Shown when no question matches. */
    empty?: unknown;
  } | undefined;
  /** The "3 of 12 questions" line under the search box (default true). */
  count?: boolean | undefined;
  /** split: entrance of the heading column (default "up"): a Reveal effect, your own `{ from, to }`, or "none". */
  reveal?: RevealOptions["effect"];
  class?: ClassProp | undefined;
}

/** `<Faq items={[{ q: "Is it free?", a: "Yes, MIT." }]} layout="split" title="Questions" search />` */
export function Faq(props: FaqProps): Element {
  const q = signal("");
  const shown = computed(() => {
    const s = q().trim();
    return s ? rank(s, props.items, (x) => ({ title: x.q, keywords: [x.keywords ?? "", typeof x.a === "string" ? x.a : ""] })).map((r) => r.item) : props.items;
  });
  const L = props.labels ?? {};
  const list = h("div", { class: "m-faq-list" },
    props.search ? h("div", { class: "m-faq-search" },
      h(SearchBox, { value: q, debounce: 120, placeholder: L.search ?? t`Search questions`, "aria-label": L.search ?? t`Search questions` }),
      props.count === false ? null : h("p", { class: "m-faq-count", "aria-live": "polite" },
        () => (q().trim() ? (L.count ? L.count(shown().length, props.items.length) : t`${shown().length} of ${props.items.length} questions`) : ""))) : null,
    () => {
      const items = shown();
      if (!items.length) return h(Empty, { size: "sm", title: false, class: "m-faq-empty" }, L.empty ?? t`No question matches. Try other words.`);
      return h(Accordion, { variant: "separated", multiple: !!props.multiple, items: items.map((x) => ({ id: x.q, title: x.q, content: x.a })) });
    });
  const split = props.layout === "split";
  // split: the heading column is a SectionHead (start aligned) with the contact line under it
  const aside = !split ? null : h(SectionHead, {
    class: "m-faq-aside", align: "start", width: "full",
    title: props.title != null ? () => val(props.title) : undefined, lead: props.lead != null ? () => val(props.lead) : undefined,
    reveal: props.reveal === "none" ? false : { effect: props.reveal ?? "up", stagger: 80 },
  }, props.contact != null ? h("div", { class: "m-faq-contact" }, props.contact) : null);
  return h("div", { class: cx("m-faq", split && "m-faq-split", val(props.class)) },
    aside,
    list) as Element;
}
