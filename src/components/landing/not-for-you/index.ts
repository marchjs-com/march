// NotForYou (march/landing): the anti-landing block. It says plainly who the product is NOT for (and, optionally,
// who it is for). With `check` every line is a toggle card: red at first ("That's me", "Not you? Tap it!"); a tap
// strikes it out, turns it green and reveals the item's positive side (`instead`), with `markedHint` under the label. A verdict line under the list sums it up
// honestly, e.g. "2 of 4 still apply". The verdict is announced politely.
import "./not-for-you.css";
import { h } from "../../../dom/h.ts";
import { signal, computed } from "../../../core/reactive.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { CheckMark } from "../../feedback/check-mark/index.ts";
import tr from "./tr.ts";

messages("tr", tr);

export interface NotForYouItem {
  /** The line: "You need offline-first sync". */
  text: unknown;
  /** One more sentence: why, or where to go instead. */
  detail?: unknown | undefined;
  /** The positive side, revealed under the line once it is struck out: "You are open to new faces". */
  instead?: unknown | undefined;
}
export interface NotForYouProps {
  /** Who it is not for. @tr Kimin için olmadığı. */
  items: NotForYouItem[];
  /** Who it is for (shown beside, with check marks). @tr Kimin için olduğu (yanda, onay işaretleriyle gösterilir). */
  forYou?: NotForYouItem[] | undefined;
  /** Heading of the "not for you" list (default "Not for you if…"); false: no heading. @tr "Not for you" listesinin başlığı (varsayılan "Not for you if…"); false: başlık yok. */
  title?: unknown | undefined;
  /** Heading of the "for you" list (default "For you if…"); false: no heading. @tr "For you" listesinin başlığı (varsayılan "For you if…"); false: başlık yok. */
  forYouTitle?: unknown | undefined;
  /** Let the visitor strike out the lines that are not them, and show a verdict. @tr Ziyaretçi kendisine uymayan satırların üstünü çizebilir ve bir sonuç gösterilir. */
  check?: boolean | undefined;
  /** The verdict text for `n` struck-out lines of `total` (default: a prompt, then how many still apply); false: no verdict line. @tr `total` satırdan `n` tanesinin üstü çizildiğinde sonuç metni (varsayılan: önce bir yönlendirme, sonra kaç tanesinin hâlâ geçerli olduğu); false: sonuç satırı yok. */
  verdict?: ((n: number, total: number) => unknown) | false | undefined;
  /** `cards` (default) · `list`: plain lines with a rule between them. @tr `cards` (varsayılan) · `list`: aralarında çizgi olan yalın satırlar. */
  variant?: "cards" | "list" | undefined;
  /** Called with the indexes of the struck-out lines. @tr Üstü çizilen satırların sıralarıyla çağrılır. */
  onCheck?: ((marked: number[]) => void) | undefined;
  /** The label on every checkable card (default "That's me"); false: no label. @tr İşaretlenebilir her karttaki etiket (varsayılan "That's me"); false: etiket yok. */
  meLabel?: unknown | undefined;
  /** Small text under the label before a tap (default "Not you? Tap it!"); false: none. @tr Dokunmadan önce etiketin altındaki küçük metin (varsayılan "Not you? Tap it!"); false: yok. */
  hint?: unknown | undefined;
  /** Small text under the label after a tap (default "Not you"): e.g. "You belong here"; false: none. @tr Dokunduktan sonra etiketin altındaki küçük metin (varsayılan "Not you"): örneğin "You belong here"; false: yok. */
  markedHint?: unknown | undefined;
  /**
   * The round marks: true (default: a cross, a tick on the "for you" lines and on a struck-out line), false (none), or
   * `(state, item, index) => content` with state "not" (applies), "marked" (struck out) or "for" (the for-you list).
   * @tr Yuvarlak işaretler: true (varsayılan: çarpı; "for you" satırlarında ve üstü çizilen satırda tik), false (yok) ya da `(state, item, index) => content`; state "not" (geçerli), "marked" (üstü çizili) ya da "for" (for-you listesi).
   */
  mark?: boolean | ((state: "not" | "marked" | "for", item: NotForYouItem, index: number) => unknown) | undefined;
  /** Extra CSS class on the root. @tr Köke eklenen ek CSS sınıfı. */
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

  const own = typeof props.mark === "function" ? props.mark : null;
  const line = (it: NotForYouItem, i: number, kind: "not" | "for"): Element => {
    const checkable = kind === "not" && !!props.check;
    const on = (): boolean => marked().has(i);
    // the round mark is a CheckMark: a cross on a "not" line, a tick on a "for" line; on a checkable line its own
    // motion turns the cross into a tick once the line is struck out
    const mark = props.mark === false ? undefined : h(CheckMark, {
      class: "m-nfy-mark", variant: "soft", label: false, value: checkable ? on : kind === "for", ...(checkable ? { motion: "flip" } : {}),
      ...(own ? { icons: { no: () => own("not", it, i), yes: () => own(checkable ? "marked" : "for", it, i) } } : {}),
    });
    const more = [
      it.detail != null ? h("span", { class: "m-nfy-detail" }, it.detail) : null,
      checkable && it.instead != null ? h("span", { class: "m-nfy-instead", "aria-hidden": () => String(!on()) }, h("span", { class: "m-nfy-instead-in" }, it.instead)) : null,
    ].filter(Boolean);
    // the line itself is a ListRow: mark, text with its detail, and (checkable) the "That's me" label at the end
    const row = (extra: Record<string, unknown>): Element => h(ListRow, { align: "start", overflow: "wrap", lead: mark, title: h("strong", null, it.text), sub: more.length ? more : undefined, ...extra }) as Element;
    if (checkable) {
      const me = props.meLabel === false ? null : h("span", { class: "m-nfy-me-label" }, () => props.meLabel ?? t`That's me`);
      const hint = props.hint === false && props.markedHint === false ? null
        : h("small", { class: "m-nfy-me-hint" }, () => { const x = on() ? props.markedHint ?? t`Not you` : props.hint ?? t`Not you? Tap it!`; return x === false ? null : x; });
      // the whole card is the checkbox
      return h("li", { class: "m-nfy-item" },
        h("button", { type: "button", class: () => cx("m-nfy-toggle", on() && "is-on"), role: "checkbox", "aria-checked": () => String(on()), onClick: () => toggle(i) },
          row({ as: "span", trail: me || hint ? h("span", { class: "m-nfy-me", "aria-hidden": "true" }, me, hint) : undefined })));
    }
    return h("li", { class: "m-nfy-item" }, row({ class: "m-nfy-row" }));
  };
  const list = (title: unknown, items: NotForYouItem[], kind: "not" | "for"): Element =>
    h("section", { class: cx("m-nfy-col", `m-nfy-${kind}`) },
      title === false ? null : h("h3", { class: "m-nfy-title" }, title),
      h("ul", { class: "m-nfy-list", role: "list" }, ...items.map((it, i) => line(it, i, kind))));

  return h("div", { class: () => cx("m-nfy", `m-nfy-v-${props.variant ?? "cards"}`, props.forYou?.length && "m-nfy-both", val(props.class)) },
    h("div", { class: "m-nfy-cols" },
      list(props.title ?? t`Not for you if…`, props.items, "not"),
      props.forYou?.length ? list(props.forYouTitle ?? t`For you if…`, props.forYou, "for") : null),
    props.check && props.verdict !== false ? h("p", { class: () => cx("m-nfy-verdict", count() >= total && "is-in", count() > 0 && count() < total && "is-some"), role: "status", "aria-live": "polite" },
      () => (props.verdict || notForYouVerdict)(count(), total)) : null);
}
