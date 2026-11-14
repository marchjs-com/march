// StatsBand (hadi-march/landing): a row of big numbers ("12k teams", "99.9 % uptime") that count up when the band
// scrolls into view (Counter), with a label and an optional note. Plain, divided by lines, or as cards.
import "./stats-band.css";
import { h } from "../../../dom/h.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";
import { locale } from "../../../core/i18n.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { Counter, formatCount } from "../counter/index.ts";
import { Reveal, type RevealOptions } from "../reveal/index.ts";
import { StatTile } from "../../data/stat-tile/index.ts";

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
  /** Counter style (default count); "none" writes the number without counting. */
  mode?: "count" | "roll" | "none" | undefined;
  /** Entrance of the items: Reveal options, or false for none (default: up, one after another). */
  reveal?: RevealOptions | false | undefined;
  class?: ClassProp | undefined;
}

/** `<StatsBand items={[{ value: 12000, label: "teams", format: { notation: "compact" } }, { value: 99.9, decimals: 1, suffix: "%", label: "uptime" }]} />` */
export function StatsBand(props: StatsBandProps): Element {
  const mode = props.mode;
  return h(Reveal, { class: cx("m-stats", `m-stats-${props.variant ?? "divided"}`, val(props.class)), effect: "up", stagger: 90, ...(props.reveal === false ? { effect: "none" } : props.reveal), as: "dl" },
    // each item is a StatTile (dt / dd inside the dl): the figure is a Counter, or plain text with mode "none"
    props.items.map((s) => h(StatTile, {
      term: true, size: "xl", variant: props.variant === "cards" ? "card" : "plain", class: "m-stats-item", label: s.label, hint: s.note ?? undefined,
      value: mode === "none"
        ? h("span", { class: "m-stats-plain" }, s.prefix ?? null, () => formatCount(s.value, s, locale()), s.suffix ?? null)
        : h(Counter, { value: s.value, format: s.format, decimals: s.decimals, prefix: s.prefix, suffix: s.suffix, mode }),
    }))) as Element;
}
