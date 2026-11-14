// NotForYou (hadi-march/landing): the anti-landing block. It says plainly who the product is NOT for (and, optionally,
// who it is for). With `check` every line is a toggle card: red at first ("That's me", "Not you? Tap it!"); a tap
// strikes it out and turns it green, with `markedHint` under the label. A verdict line under the list sums it up
// honestly, e.g. "2 of 4 still apply". The verdict is announced politely.
import "./not-for-you.css";
import { h } from "../../../dom/h.ts";
import { signal, computed } from "../../../core/reactive.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, val, glyph, type ClassProp } from "../../../ui/util.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { check as checkIcon } from "../../../icons/glyphs/check.ts";
import tr from "./tr.ts";

messages("tr", tr);

export interface NotForYouItem {
  /** The line: "You need offline-first sync". */
  text: unknown;
  /** One more sentence: why, or where to go instead. */
  detail?: unknown | undefined;
}
export interface NotForYouProps {
  /** Who it is not for. */
  items: NotForYouItem[];
  /** Who it is for (shown beside, with check marks). */
  forYou?: NotForYouItem[] | undefined;
  /** Heading of the "not for you" list (default "Not for you if…"). */
  title?: unknown | undefined;
  /** Heading of the "for you" list (default "For you if…"). */
  forYouTitle?: unknown | undefined;
  /** Let the visitor strike out the lines that are not them, and show a verdict. */
  check?: boolean | undefined;
  /** The verdict text for `n` struck-out lines of `total` (default: a prompt, then how many still apply). */
  verdict?: ((n: number, total: number) => unknown) | undefined;
  /** `cards` (default) · `list`: plain lines with a rule between them. */
  variant?: "cards" | "list" | undefined;
  /** Called with the indexes of the struck-out lines. */
  onCheck?: ((marked: number[]) => void) | undefined;
  /** The label on every checkable card (default "That's me"). */
  meLabel?: unknown | undefined;
  /** Small text under the label before a tap (default "Not you? Tap it!"). */
  hint?: unknown | undefined;
  /** Small text under the label after a tap (default "Not you"): e.g. "You belong here". */
  markedHint?: unknown | undefined;
  class?: ClassProp | undefined;
}

/** Default verdict for `n` struck-out lines of `total`: a prompt, all ruled out, or how many still apply. */
export function notForYouVerdict(n: number, total: number): string {
  if (!n) return t`Strike out the lines that are not you.`;
  if (n >= total) return t`None of these is you. Good: read on.`;
  return t`${total - n} of ${total} still apply. Worth a closer look before you decide.`;
}

/** `<NotForYou check items={[{ text: "You need offline sync", detail: "…" }]} forYou={[…]} />` */
export function NotForYou(props: NotForYouProps): Element {
  const marked = signal<ReadonlySet<number>>(new Set());
  const total = props.items.length;
  const toggle = (i: number): void => {
    const next = new Set(marked.peek());
    if (next.has(i)) next.delete(i); else next.add(i);
    marked.set(next);
    props.onCheck?.([...next].sort((a, b) => a - b));
  };
  const count = computed(() => marked().size);

  const line = (it: NotForYouItem, i: number, kind: "not" | "for"): Element => {
    const body = [
      h("span", { class: "hm-nfy-mark", "aria-hidden": "true" }, glyph(kind === "not" ? xIcon : checkIcon)),
      h("span", { class: "hm-nfy-text" }, h("strong", null, it.text), it.detail != null ? h("span", { class: "hm-nfy-detail" }, it.detail) : null),
    ];
    if (kind === "not" && props.check) {
      return h("li", { class: "hm-nfy-item" },
        h("button", {
          type: "button", class: () => cx("hm-nfy-toggle", marked().has(i) && "is-on"), role: "checkbox",
          "aria-checked": () => String(marked().has(i)), onClick: () => toggle(i),
        }, ...body, h("span", { class: "hm-nfy-me", "aria-hidden": "true" },
          h("span", { class: "hm-nfy-me-label" }, () => props.meLabel ?? t`That's me`),
          h("small", { class: "hm-nfy-me-hint" }, () => (marked().has(i) ? props.markedHint ?? t`Not you` : props.hint ?? t`Not you? Tap it!`)))));
    }
    return h("li", { class: "hm-nfy-item" }, h("div", { class: "hm-nfy-row" }, ...body));
  };
  const list = (title: unknown, items: NotForYouItem[], kind: "not" | "for"): Element =>
    h("section", { class: cx("hm-nfy-col", `hm-nfy-${kind}`) },
      h("h3", { class: "hm-nfy-title" }, title),
      h("ul", { class: "hm-nfy-list", role: "list" }, ...items.map((it, i) => line(it, i, kind))));

  return h("div", { class: () => cx("hm-nfy", `hm-nfy-v-${props.variant ?? "cards"}`, props.forYou?.length && "hm-nfy-both", val(props.class)) },
    h("div", { class: "hm-nfy-cols" },
      list(props.title ?? t`Not for you if…`, props.items, "not"),
      props.forYou?.length ? list(props.forYouTitle ?? t`For you if…`, props.forYou, "for") : null),
    props.check ? h("p", { class: () => cx("hm-nfy-verdict", count() >= total && "is-in", count() > 0 && count() < total && "is-some"), role: "status", "aria-live": "polite" },
      () => (props.verdict ?? notForYouVerdict)(count(), total)) : null);
}
