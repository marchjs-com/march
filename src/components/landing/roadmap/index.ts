// Roadmap (hadi-march/landing): a Timeline whose line fills as you scroll — a product roadmap, a company story or a
// work history. Each entry has a status (done, now, next); the dot of every entry the fill has passed lights up and the
// current one pulses. The fill is the motion core's scrollIndicator (scaleY).
import "./roadmap.css";
import { h } from "../../../dom/h.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { Progress } from "../../feedback/progress/index.ts";
import { Timeline, type TimelineItem } from "../../../ui/timeline.ts";
import { Badge } from "../../../ui/badge.ts";
import { t } from "../../../core/i18n.ts";
import { scrollIndicator, onScrollProgress } from "../../../motion/scroll-fx.ts";
// Reveal: entries enter one after another
import { revealOnScroll, type RevealOptions } from "../reveal/index.ts";
import { type ColorToken } from "../../../theme/colors.ts";

export type RoadmapStatus = "done" | "now" | "next";
export interface RoadmapItem { time?: unknown; title: unknown; body?: unknown; status?: RoadmapStatus | undefined; icon?: unknown }
export interface RoadmapProps {
  items: readonly RoadmapItem[];
  /** The status badge next to each title: true (default), false, or `(status, text) => node`. */
  badges?: boolean | ((status: RoadmapStatus, text: unknown) => unknown) | undefined;
  /** Fill the line with the scroll (default true). */
  scroll?: boolean | undefined;
  /** The line with its fill (default true); false leaves the dots only. */
  rail?: boolean | undefined;
  /** Texts of the statuses (defaults: "Done", "In progress", "Planned"). */
  labels?: Partial<Record<RoadmapStatus, unknown>> | undefined;
  /** Entrance of the entries: Reveal options, or false for none (default: from the start, one after another). */
  reveal?: RevealOptions | false | undefined;
  class?: ClassProp | undefined;
}

const TONE: Record<RoadmapStatus, TimelineItem["tone"]> = { done: "success", now: "info", next: undefined };

/** `<Roadmap items={[{ time: "2025 Q1", title: "Launch", status: "done" }, { time: "Q3", title: "Teams", status: "now" }]} />` */
export function Roadmap(props: RoadmapProps): Element {
  const label = (s: RoadmapStatus): unknown => props.labels?.[s] ?? (s === "done" ? t`Done` : s === "now" ? t`In progress` : t`Planned`);
  const own = typeof props.badges === "function" ? props.badges : null;
  const items = props.items.map((x) => ({
    time: x.time, icon: x.icon, tone: TONE[x.status ?? "next"], class: `is-${x.status ?? "next"}`, // the status styles the dot (colour, pulse)
    title: props.badges !== false && x.status ? h("span", { class: "m-rm-title" }, x.title,
      own ? own(x.status, label(x.status)) : h(Badge, { tone: x.status === "done" ? "success" : x.status === "now" ? "info" : "neutral", class: "m-rm-badge" }, label(x.status))) : x.title,
    body: x.body,
  })) as TimelineItem[];
  const tl = h(Timeline, { items, line: false, class: "m-rm-tl" }) as HTMLElement;
  const rail = props.rail !== false, scroll = props.scroll !== false;
  // the rail is a vertical Progress line over the Timeline: the scroll drives its fill (full without `scroll`)
  let fill: HTMLElement | null = null;
  const root = h("div", { class: cx("m-rm", scroll && "is-scroll", val(props.class)) },
    rail ? h(Progress, { variant: "line", orientation: "vertical", decorative: true, smooth: false, class: "m-rm-rail", ...(scroll ? { fillRef: (x: HTMLElement) => { fill = x; } } : { value: 100 }) }) : null, tl) as HTMLElement;
  if (scroll) {
    // the motion core's scrollIndicator fills the line (an indicator: it keeps working with reduced motion); the dots
    // the fill has passed light up
    const range: [number, number] = [0.2, 0.75];
    if (fill) owned(scrollIndicator(fill, { track: root, range, vertical: true }));
    owned(onScrollProgress({ track: root, range }, (p) => {
      const r = root.getBoundingClientRect(), edge = r.top + p * r.height;
      for (const li of tl.children as HTMLCollectionOf<HTMLElement>) li.classList.toggle("is-passed", li.getBoundingClientRect().top + 10 <= edge);
    }));
  }
  if (props.reveal !== false) owned(revealOnScroll(tl, { effect: "start", stagger: 90, distance: 20, ...props.reveal }));
  return root;
}
