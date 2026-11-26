// Reference marks on an x/y plot: target and threshold lines, bands (ranges of values or dates), the average / median /
// min / max of a series, and point annotations. A chart hands over how to place a value; the marks only draw.
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { attr, each, num, f1, type Box, type MaybeReactive } from "./util.ts";
import { dashOf } from "./curve.ts";
import { read } from "../core/reactive.ts";
import { clamp } from "../core/util.ts";

/** A statistic of a series used as a value. */
export type RefStat = "average" | "median" | "min" | "max";
/** One reference mark. Give `y` (horizontal), `x` (vertical) or `at` (a point). A pair makes a band. */
export interface RefMark {
  /** A value line, a `[from, to]` band, or a statistic of `series` ("average", "median", "min", "max"). @tr Bir değer çizgisi, `[from, to]` bandı ya da `series` serisinin bir istatistiği ("average", "median", "min", "max"). */
  y?: number | RefStat | readonly [number, number];
  /** A line at an x value (date, number or category) or a `[from, to]` band. @tr Bir x değerinde (tarih, sayı ya da kategori) çizgi ya da `[from, to]` bandı. */
  x?: unknown;
  /** A point annotation `[x, y]`: a ring and a label. @tr Nokta notu `[x, y]`: bir halka ve bir etiket. */
  at?: readonly [unknown, number];
  /** Text at the mark (default: the value; statistics name themselves). `false` hides it. @tr İşaretteki yazı (varsayılan: değer; istatistikler kendi adını yazar). `false` gizler. */
  label?: unknown;
  /** The series a statistic is taken from (default the first visible). @tr İstatistiğin alındığı seri (varsayılan ilk görünen). */
  series?: string;
  /** Theme color token ("danger", "success", "brand-blue", "cat-3"…; default neutral). @tr Tema renk belirteci ("danger", "success", "brand-blue", "cat-3"…; varsayılan nötr). */
  color?: string;
  /** Line style: "dashed" (default for lines), "solid", "dotted" or a dash array. @tr Çizgi biçimi: "dashed" (çizgilerde varsayılan), "solid", "dotted" ya da bir kesik dizisi. */
  dash?: string;
  /** Value axis of a `y` mark: "left" (default) or "right". @tr `y` işaretinin değer ekseni: "left" (varsayılan) ya da "right". */
  axis?: "left" | "right";
  /** Extra class on the mark's group. @tr İşaretin grubuna ek sınıf. */
  class?: string;
}
export type RefMarksProp = MaybeReactive<readonly RefMark[] | null | undefined> | undefined;

/** How a chart places values for its marks (pixels inside the plot box; null = off the plot). */
export interface MarkScales {
  box: () => Box;
  x: (v: unknown) => number | null;
  /** Band width of a category x (bands then cover whole categories); 0 for continuous axes. */
  xBand?: () => number;
  y: (v: number, axis: "left" | "right") => number | null;
  stat: (s: RefStat, series: string | undefined) => number | null;
  fmtX: (v: unknown) => unknown;
  fmtY: (v: unknown, axis: "left" | "right") => unknown;
}

const STAT: Record<RefStat, () => string> = { average: () => t`Average`, median: () => t`Median`, min: () => t`Min`, max: () => t`Max` };
/** Average / median / min / max of the non-null values. */
export function statOf(vals: readonly (number | null | undefined)[], s: RefStat): number | null {
  const v = vals.filter((x): x is number => x != null && isFinite(x));
  if (!v.length) return null;
  if (s === "min") return Math.min(...v);
  if (s === "max") return Math.max(...v);
  if (s === "average") return v.reduce((a, b) => a + b, 0) / v.length;
  const o = v.slice().sort((a, b) => a - b), m = o.length >> 1;
  return o.length % 2 ? (o[m] as number) : ((o[m - 1] as number) + (o[m] as number)) / 2;
}

interface Drawn { key: string; kind: "h" | "v" | "hb" | "vb" | "pt"; a: number; b: number; c: number; label: string; color?: string | undefined; dash: string | null; cls?: string | undefined; stat?: boolean }

/** Draws the marks (behind or above the series, as the chart places it). */
export function RefMarks({ marks, scales, layer }: { marks: RefMarksProp; scales: MarkScales; layer: "back" | "front" }): Element {
  const drawn = attr((): Drawn[] => {
    const list = read(marks) ?? [], bx = scales.box(), out: Drawn[] = [];
    list.forEach((m, i) => {
      const lab = (def: unknown): string => (m.label === false ? "" : String(m.label ?? def ?? ""));
      const axis = m.axis ?? "left";
      const base = { color: m.color, cls: m.class };
      if (m.at && layer === "front") {
        const x = scales.x(m.at[0]), y = scales.y(m.at[1], axis);
        if (x != null && y != null) out.push({ key: `p${i}`, kind: "pt", a: x, b: y, c: 0, label: lab(scales.fmtY(m.at[1], axis)), dash: null, ...base });
      }
      if (m.y != null) {
        if (Array.isArray(m.y)) {
          if (layer !== "back") return;
          const a = scales.y(m.y[0] as number, axis), b = scales.y(m.y[1] as number, axis);
          if (a != null && b != null) out.push({ key: `yb${i}`, kind: "hb", a: clamp(Math.min(a, b), 0, bx.h), b: clamp(Math.max(a, b), 0, bx.h), c: 0, label: lab(""), dash: null, ...base });
        } else if (layer === "front") {
          const v = typeof m.y === "string" ? scales.stat(m.y as RefStat, m.series) : num(m.y);
          const p = v == null ? null : scales.y(v, axis);
          if (p != null && p >= -0.5 && p <= bx.h + 0.5) out.push({ key: `y${i}`, kind: "h", a: p, b: 0, c: 0, label: lab(typeof m.y === "string" ? `${STAT[m.y as RefStat]?.() ?? m.y} ${scales.fmtY(v, axis)}` : scales.fmtY(v, axis)), dash: dashOf(m.dash ?? "dashed"), stat: typeof m.y === "string", ...base });
        }
      }
      if (m.x != null) {
        const band = scales.xBand?.() ?? 0;
        if (Array.isArray(m.x)) {
          if (layer !== "back") return;
          const a = scales.x(m.x[0]), b = scales.x(m.x[1]);
          if (a != null && b != null) out.push({ key: `xb${i}`, kind: "vb", a: clamp(Math.min(a, b) - band / 2, 0, bx.w), b: clamp(Math.max(a, b) + band / 2, 0, bx.w), c: 0, label: lab(""), dash: null, ...base });
        } else if (layer === "front") {
          const p = scales.x(m.x);
          if (p != null && p >= -0.5 && p <= bx.w + 0.5) out.push({ key: `x${i}`, kind: "v", a: p, b: 0, c: 0, label: lab(scales.fmtX(m.x)), dash: dashOf(m.dash ?? "dashed"), ...base });
        }
      }
    });
    return out;
  });
  return h("g", { class: `m-chart-refs m-chart-refs-${layer}`, transform: attr(() => `translate(${scales.box().x},${scales.box().y})`) },
    each<Drawn>({ each: drawn, key: (d) => d.key, children: (d) => {
      const k = d().kind;
      const style = (): Record<string, string> | undefined => { const c = d().color; return c ? { "--m-ref": c.startsWith("--") ? `var(${c})` : `var(--m-${c})` } : undefined; };
      const cls = (): string => `m-chart-ref m-chart-ref-${k}${d().cls ? ` ${d().cls}` : ""}`;
      if (k === "hb" || k === "vb") return h("g", { class: cls, style },
        h("rect", k === "hb" ? { x: 0, width: () => scales.box().w, y: () => f1(d().a), height: () => f1(d().b - d().a) } : { y: 0, height: () => scales.box().h, x: () => f1(d().a), width: () => f1(d().b - d().a) }),
        h("text", k === "hb" ? { x: 6, y: () => f1(d().a + 12) } : { x: () => f1(d().a + 4), y: 12 }, () => d().label));
      if (k === "pt") return h("g", { class: cls, style, transform: () => `translate(${f1(d().a)},${f1(d().b)})` },
        h("circle", { r: 5 }), h("line", { x1: 0, y1: -6, x2: 0, y2: -18 }), h("text", { y: -22, "text-anchor": "middle" }, () => d().label));
      return h("g", { class: cls, style },
        h("line", k === "h" ? { x1: 0, x2: () => scales.box().w, y1: () => f1(d().a), y2: () => f1(d().a), "stroke-dasharray": () => d().dash } : { y1: 0, y2: () => scales.box().h, x1: () => f1(d().a), x2: () => f1(d().a), "stroke-dasharray": () => d().dash }),
        // statistics label at the start of their line, values at the end: two lines close together keep both labels
        h("text", k === "h" ? (d().stat ? { x: 4, y: () => f1(d().a - 5) } : { x: () => scales.box().w - 4, y: () => f1(d().a - 5), "text-anchor": "end" }) : { x: () => f1(d().a + 4), y: 12 }, () => d().label));
    } }));
}
