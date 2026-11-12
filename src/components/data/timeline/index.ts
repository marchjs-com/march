// Timeline (hadi-march/ui). Folder: src/components/data/timeline/.
import "./timeline.css";
import { h } from "../../../dom/h.ts";
import { applyPipe, toDate } from "../../../core/pipes.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { Tone } from "../../../ui/display-base.ts";

/** A Timeline entry; `time` may be a Date, epoch ms, ISO string (formatted) or text. */
export interface TimelineItem { time?: MaybeFn<unknown> | undefined; title?: MaybeFn<unknown> | undefined; body?: unknown; tone?: Tone | undefined; icon?: unknown }
export interface TimelineProps { items: MaybeFn<readonly TimelineItem[] | null | undefined>; class?: ClassProp }
/** `<Timeline items={[{ time, title, body, tone, icon }]} />` — time may be a Date/epoch/ISO (formatted) or text. */
export function Timeline(props: TimelineProps): Element {
  const fmt = (v: unknown): unknown => (typeof v === "string" && !toDate(v) ? v : v instanceof Date || typeof v === "number" || toDate(v) ? applyPipe("datetime", v) : v);
  return h("ol", { class: () => cx("hm-timeline", val(props.class)) },
    () => (val(props.items) ?? []).map((x) => h("li", { class: cx("hm-tl-item", x.tone && `hm-tl-${x.tone}`) },
      h("span", { class: "hm-tl-dot", "aria-hidden": "true" }, icon(x.icon)),
      h("div", { class: "hm-tl-main" },
        x.time != null && h("time", { class: "hm-tl-time", datetime: toDate(x.time)?.toISOString?.() ?? null }, () => fmt(val(x.time))),
        x.title != null && h("div", { class: "hm-tl-title" }, () => val(x.title)),
        x.body != null && h("div", { class: "hm-tl-body" }, typeof x.body === "function" && !x.body.length ? (x.body as () => unknown)() : x.body)))));
}
