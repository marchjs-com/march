// The two lines under an editable time chart (Scheduler, Gantt): the hint that says how to drag and which keys work,
// and the polite live region its changes are said in ("Build: 9 Nov – 13 Nov"). One definition for both charts.
import "./hint.css";
import { h } from "../../../dom/h.ts";

/** Options of chartHint(). */
export interface ChartHintOptions {
  /** Id base of the chart: the hint gets `<id>-help` (the chart points at it with `aria-describedby`). */
  id: string;
  /** Class prefix of the chart ("hm-sch", "hm-gantt"): the parts are `<prefix>-help` and `<prefix>-status`. */
  prefix: string;
  /** The hint: `false` none, `true` / unset the chart's own text (`text`), anything else your own node. */
  help: unknown;
  /** The chart's own hint text (live). */
  text: () => string;
  /** What the live region says (live). */
  status: () => string;
}

/** The hint paragraph (unless `help` is false) and the visually hidden status region of a time chart. */
export function chartHint(o: ChartHintOptions): unknown[] {
  return [
    o.help === false ? null : h("p", { class: `hm-chart-hint ${o.prefix}-help`, id: `${o.id}-help` }, o.help != null && o.help !== true ? o.help : o.text),
    h("div", { class: `${o.prefix}-status hm-sr-only`, role: "status", "aria-live": "polite" }, o.status),
  ];
}
