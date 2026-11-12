// Roadmap (hadi-march/landing): a Timeline whose line fills as you scroll — a product roadmap, a company story or a
// work history. Each entry has a status (done, now, next); the dot of every entry the fill has passed lights up and the
// current one pulses. The fill is a transform (scaleY) written in the scroll scene's write phase.
import "./roadmap.css";
import { h } from "../../../dom/h.ts";
import { onCleanup, getOwner } from "../../../core/reactive.ts";
import { cx, val, setStyle, clamp, type ClassProp } from "../../../ui/util.ts";
import { Timeline, type TimelineItem } from "../../../ui/timeline.ts";
import { Badge } from "../../../ui/badge.ts";
import { t } from "../../../core/i18n.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { scrollScene } from "../../../motion/scroll-scene.ts";
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
    scrollScene(root, (s) => {
      // the line is full when the end of the list reaches 60 % of the viewport height
      const p = reducedMotion() ? 1 : clamp((s.vh * 0.6 - s.top) / Math.max(1, s.height), 0, 1);
      setStyle(fill, { transform: `scaleY(${p.toFixed(4)})` });
      const edge = s.top + p * s.height;
      for (const li of tl.children as HTMLCollectionOf<HTMLElement>) li.classList.toggle("is-passed", li.getBoundingClientRect().top + 10 <= edge);
    });
  }
  const stop = revealOnScroll(tl, { effect: "start", stagger: 90, distance: 20 });
  if (getOwner()) onCleanup(stop);
  return root;
}
