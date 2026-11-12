// Roadmap (hadi-march/landing): a Timeline whose line fills as you scroll — a product roadmap, a company story or a
// work history. Each entry has a status (done, now, next); the dot of every entry the fill has passed lights up and the
// current one pulses. The fill is the motion core's scrollIndicator (scaleY).
import "./roadmap.css";
import { h } from "../../../dom/h.ts";
import { onCleanup, getOwner } from "../../../core/reactive.ts";
import { cx, val, setStyle, clamp, type ClassProp } from "../../../ui/util.ts";
import { Timeline, type TimelineItem } from "../../../ui/timeline.ts";
import { Badge } from "../../../ui/badge.ts";
import { t } from "../../../core/i18n.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { scrollIndicator, onScrollProgress } from "../../../motion/scroll-fx.ts";
// Reveal: entries enter one after another
import { revealOnScroll } from "../reveal/index.ts";

export type RoadmapStatus = "done" | "now" | "next";
export interface RoadmapItem { time?: unknown; title: unknown; body?: unknown; status?: RoadmapStatus | undefined; icon?: unknown }
export interface RoadmapProps {
  items: readonly RoadmapItem[];
  /** Show a status badge next to each title (default true). */
  badges?: boolean | undefined;
  /** Fill the line with the scroll (default true). */
  scroll?: boolean | undefined;
  class?: ClassProp | undefined;
}

const TONE: Record<RoadmapStatus, TimelineItem["tone"]> = { done: "success", now: "info", next: undefined };

/** `<Roadmap items={[{ time: "2025 Q1", title: "Launch", status: "done" }, { time: "Q3", title: "Teams", status: "now" }]} />` */
export function Roadmap(props: RoadmapProps): Element {
  const label = (s: RoadmapStatus): string => (s === "done" ? t`Done` : s === "now" ? t`In progress` : t`Planned`);
  const items = props.items.map((x) => ({
    time: x.time, icon: x.icon, tone: TONE[x.status ?? "next"],
    title: props.badges !== false && x.status ? h("span", { class: "hm-rm-title" }, x.title, h(Badge, { tone: x.status === "done" ? "success" : x.status === "now" ? "info" : "neutral", class: "hm-rm-badge" }, label(x.status))) : x.title,
    body: x.body,
  })) as TimelineItem[];
  const fill = h("span", { class: "hm-rm-fill", "aria-hidden": "true" }) as HTMLElement;
  const tl = h(Timeline, { items, class: "hm-rm-tl" }) as HTMLElement;
  const root = h("div", { class: cx("hm-rm", props.scroll !== false && "is-scroll", val(props.class)) }, h("span", { class: "hm-rm-rail", "aria-hidden": "true" }, fill), tl) as HTMLElement;
  // statuses on the list items (dot colours, pulse)
  queueMicrotask(() => [...tl.children].forEach((li, i) => li.classList.add(`is-${props.items[i]?.status ?? "next"}`)));
  if (props.scroll !== false) {
    // the motion core's scrollTimeline fills the line (an indicator: it keeps working with reduced motion); the dots
    // the fill has passed light up
    const range: [number, number] = [0.2, 0.75];
    const offs = [scrollIndicator(fill, { track: root, range, vertical: true }), onScrollProgress({ track: root, range }, (p) => {
      const r = root.getBoundingClientRect(), edge = r.top + p * r.height;
      for (const li of tl.children as HTMLCollectionOf<HTMLElement>) li.classList.toggle("is-passed", li.getBoundingClientRect().top + 10 <= edge);
    })];
    if (getOwner()) onCleanup(() => offs.forEach((f) => f()));
  }
  const stop = revealOnScroll(tl, { effect: "start", stagger: 90, distance: 20 });
  if (getOwner()) onCleanup(stop);
  return root;
}
