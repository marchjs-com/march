// Timeline (march/ui). Folder: src/components/data/timeline/.
import "./timeline.css";
import { h } from "../../../dom/h.ts";
import { applyPipe, toDate } from "../../../core/pipes.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { Tone } from "../../../ui/display-base.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { StatusDot, type StatusDotTone } from "../../feedback/status-dot/index.ts";
import { withColor } from "../../../theme/colors.ts";

const TONES: readonly StatusDotTone[] = ["primary", "info", "success", "warn", "danger"];

/** A Timeline entry; `time` may be a Date, epoch ms, ISO string (formatted) or text. */
export interface TimelineItem { time?: MaybeFn<unknown> | undefined; title?: MaybeFn<unknown> | undefined; body?: unknown; tone?: Tone | undefined; /** Dot colour as a theme token ("brand-orange" …); wins over `tone`. */ color?: ColorToken | undefined; icon?: unknown; /** Extra class on this item's `<li>` (a state the host styles). */ class?: string | undefined }
export interface TimelineProps {
  /** The entries: time, title, body, tone or colour, icon. @tr Girdiler: zaman, başlık, gövde, ton ya da renk, ikon. */
  items: MaybeFn<readonly TimelineItem[] | null | undefined>;
  /** The dot of every item: true (default), false, or `(item, index) => node`. @tr Her ögenin noktası: true (varsayılan), false ya da `(item, index) => node`. */
  dot?: boolean | ((item: TimelineItem, index: number) => unknown) | undefined;
  /** The line that connects the items (default true). @tr Ögeleri birleştiren çizgi (varsayılan true). */
  line?: boolean | undefined;
  /** Your own text for a time value (default: Date / epoch / ISO are formatted as date and time, text stays). @tr Bir zaman değeri için kendi metniniz (varsayılan: Date / epoch / ISO tarih ve saat olarak biçimlenir, metin olduğu gibi kalır). */
  formatTime?: ((value: unknown) => unknown) | undefined;
  /** Extra CSS classes on the list. @tr Listeye eklenen CSS sınıfları. */
  class?: ClassProp;
}
/** `<Timeline items={[{ time, title, body, tone, icon }]} />` — time may be a Date/epoch/ISO (formatted) or text. */
export function Timeline(props: TimelineProps): Element {
  const fmt = (v: unknown): unknown => (typeof v === "string" && !toDate(v) ? v : v instanceof Date || typeof v === "number" || toDate(v) ? applyPipe("datetime", v) : v);
  const time = (v: unknown): unknown => (props.formatTime ? props.formatTime(v) : fmt(v));
  return h("ol", { class: () => cx("m-timeline", props.line === false && "m-timeline-no-line", val(props.class)) },
    () => (val(props.items) ?? []).map((x, i, all) => h("li", { class: cx("m-tl-item", x.tone && `m-tl-${x.tone}`, x.class) },
      // the connecting line: an element of its own (not a pseudo-element), down to the next item; live with `line`
      i < all.length - 1 ? () => (props.line === false ? null : h("span", { class: "m-tl-line", "aria-hidden": "true" })) : null,
      props.dot === false ? null : typeof props.dot === "function" ? h("span", { class: "m-tl-dot is-own", "aria-hidden": "true" }, props.dot(x, i))
        : withColor(h(StatusDot, { class: "m-tl-dot", hollow: true, tone: TONES.includes(x.tone as StatusDotTone) ? x.tone as StatusDotTone : "neutral" }, icon(x.icon)), x.color),
      h("div", { class: "m-tl-main" },
        x.time != null && h("time", { class: "m-tl-time", datetime: toDate(x.time)?.toISOString?.() ?? null }, () => time(val(x.time))),
        x.title != null && h("div", { class: "m-tl-title" }, () => val(x.title)),
        x.body != null && h("div", { class: "m-tl-body" }, typeof x.body === "function" && !x.body.length ? (x.body as () => unknown)() : x.body)))));
}
