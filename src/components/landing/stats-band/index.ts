// StatsBand (hadi-march/landing): a row of big numbers ("12k teams", "99.9 % uptime") that count up when the band
// scrolls into view (Counter), with a label and an optional note. Plain, divided by lines, or as cards.
import "./stats-band.css";
import { h } from "../../../dom/h.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";
import { Counter } from "../counter/index.ts";
import { Reveal } from "../reveal/index.ts";

export interface StatItem {
  value: number;
  label: unknown;
  note?: unknown;
  format?: Intl.NumberFormatOptions | undefined;
  decimals?: number | undefined;
  prefix?: unknown;
  suffix?: unknown;
}
export interface StatsBandProps {
  items: readonly StatItem[];
  variant?: "plain" | "divided" | "cards" | undefined;
  /** Counter style (default count). */
  mode?: "count" | "roll" | undefined;
  class?: ClassProp | undefined;
}

/** `<StatsBand items={[{ value: 12000, label: "teams", format: { notation: "compact" } }, { value: 99.9, decimals: 1, suffix: "%", label: "uptime" }]} />` */
export function StatsBand(props: StatsBandProps): Element {
  return h(Reveal, { class: cx("hm-stats", `hm-stats-${props.variant ?? "divided"}`, val(props.class)), effect: "up", stagger: 90, as: "dl" },
    props.items.map((s) => h("div", { class: "hm-stats-item" },
      h("dt", { class: "hm-stats-label" }, s.label),
      h("dd", { class: "hm-stats-value" }, h(Counter, { value: s.value, format: s.format, decimals: s.decimals, prefix: s.prefix, suffix: s.suffix, mode: props.mode })),
      s.note != null ? h("dd", { class: "hm-stats-note" }, s.note) : null))) as Element;
}
