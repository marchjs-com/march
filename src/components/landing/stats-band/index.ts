// StatsBand (march/landing): a row of big numbers ("12k teams", "99.9 % uptime") that count up when the band
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
  /** The figure, or an accessor: a new value is counted to (from 0, the first time). */
  value: number | (() => number);
  label: unknown;
  note?: unknown;
  format?: Intl.NumberFormatOptions | undefined;
  decimals?: number | undefined;
  prefix?: unknown;
  suffix?: unknown;
}
export interface StatsBandProps {
  /** The figures: `{ value, label, note?, format?, decimals?, prefix?, suffix? }`. @tr Rakamlar: `{ value, label, note?, format?, decimals?, prefix?, suffix? }`. */
  items: readonly StatItem[];
  /** Look: plain, divided (default) or cards. @tr Görünüm: plain, divided (varsayılan) ya da cards. */
  variant?: "plain" | "divided" | "cards" | undefined;
  /** Counter style (default count); "none" writes the number without counting. @tr Sayaç biçimi (varsayılan count); "none" sayıyı saymadan yazar. */
  mode?: "count" | "roll" | "none" | undefined;
  /** How long each figure counts, ms (default: the Counter's, 1600 for count). @tr Her rakamın sayma süresi, ms (varsayılan: Counter'ınki, count için 1600). */
  duration?: number | undefined;
  /** Easing of the count (a motion easing name, e.g. "in-out"; default: the Counter's, "expo"). @tr Sayımın yumuşatması (bir hareket easing adı, ör. "in-out"; varsayılan: Counter'ınki, "expo"). */
  easing?: string | undefined;
  /** Entrance of the items: Reveal options, or false for none (default: up, one after another). @tr Öğelerin girişi: Reveal seçenekleri ya da hiç giriş olmaması için false (varsayılan: up, art arda). */
  reveal?: RevealOptions | false | undefined;
  /** Extra CSS class on the list. @tr Listeye eklenen ek CSS sınıfı. */
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
        ? h("span", { class: "m-stats-plain" }, s.prefix ?? null, () => formatCount(val(s.value), s, locale()), s.suffix ?? null)
        : h(Counter, { value: s.value, format: s.format, decimals: s.decimals, prefix: s.prefix, suffix: s.suffix, mode, duration: props.duration, easing: props.easing }),
    }))) as Element;
}
