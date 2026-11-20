// Heatmap: a grid or calendar of intensities (march/charts). Folder: src/components/data/heatmap/; shared chart parts (scales, axes, tooltip, data table,
// formats) are in src/charts/.
// Heatmap: x × y grid of cells colored by value level (`m-heat-0..4`), e.g. weekday × hour.
// `calendar` mode lays out daily values as weeks (columns) × weekdays (rows), e.g. the last 12 weeks.
import "./heatmap.css";
import { signal, computed, read } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { applyPipe, toDate } from "../../../core/pipes.ts";
import { locale } from "../../../core/i18n.ts";
import { rowsOf, accessor, formatter, num, useSize, attr, textWidth, each,
  type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type Getter, type TooltipProp, f1 } from "../../../charts/util.ts";
import { Frame, tooltipState, showTip, tipBody, thin } from "../../../charts/parts.ts";
import { clamp } from "../../../core/util.ts";
import { ease, cssOf } from "../../../motion/engine/ease.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** One heatmap cell (also the `datum` of a heatmap point). */
export interface HeatCell { key: string; xi: number; yi: number; value: number | null; label: unknown; future?: boolean }
/** Point passed to `tooltip(point)` and `onSelect(point)` of a heatmap. */
export interface HeatPoint { index: number; x: unknown; y: unknown; value: number | null; label: unknown; datum: HeatCell }
export interface HeatmapProps<D = unknown> extends ChartBaseProps {
  /** Rows: an array (or signal / function returning one) of objects. @tr Satırlar: nesnelerden oluşan bir dizi (ya da onu döndüren sinyal / fonksiyon). */
  data?: DataProp<D>;
  /** Column key or getter (default "x"); a date in calendar mode. @tr Sütun anahtarı ya da getter (varsayılan "x"); takvim modunda bir tarih. */
  x?: Field<D> | undefined;
  /** Row key or getter (default "y"). @tr Satır anahtarı ya da getter (varsayılan "y"). */
  y?: Field<D> | undefined;
  /** Cell value key or getter (default "value"); duplicates are summed. @tr Hücre değeri anahtarı ya da getter (varsayılan "value"); tekrar edenler toplanır. */
  value?: Field<D> | undefined;
  /** `true` or `{ weeks }` (default 12): columns are weeks, rows Monday…Sunday. @tr `true` ya da `{ weeks }` (varsayılan 12): sütunlar haftalar, satırlar Pazartesi…Pazar. */
  calendar?: Opt<boolean | { weeks?: number }>;
  /** Last day of the calendar (default the latest date in the data). @tr Takvimin son günü (varsayılan verideki en son tarih). */
  end?: Opt<unknown>;
  /** Format of the column labels (default String). @tr Sütun etiketlerinin biçimi (varsayılan String). */
  xFormat?: Opt<FormatSpec>;
  /** Format of the row labels (default String). @tr Satır etiketlerinin biçimi (varsayılan String). */
  yFormat?: Opt<FormatSpec>;
  /** Order (and completeness) of the columns (default data order). @tr Sütunların sırası (ve eksiksizliği) (varsayılan veri sırası). */
  xDomain?: Opt<readonly unknown[]>;
  /** Order (and completeness) of the rows (default data order). @tr Satırların sırası (ve eksiksizliği) (varsayılan veri sırası). */
  yDomain?: Opt<readonly unknown[]>;
  /** Format of the cell values in tooltip and table. @tr Araç ipucu ve tablodaki hücre değerlerinin biçimi. */
  format?: Opt<FormatSpec>;
  /** Number of color levels (default 5; level 0 = empty or ≤ 0). @tr Renk düzeyi sayısı (varsayılan 5; 0. düzey = boş ya da ≤ 0). */
  levels?: Opt<number>;
  /** Value of the top level (default the data maximum). @tr En üst düzeyin değeri (varsayılan verideki en büyük değer). */
  max?: Opt<number>;
  /** Fixed cell size in px (default fits the width, at most 32). @tr px cinsinden sabit hücre boyutu (varsayılan genişliğe sığar, en çok 32). */
  cell?: Opt<number>;
  /** Label of the value row in the tooltip (default "Value"). @tr Araç ipucundaki değer satırının etiketi (varsayılan "Value"). */
  valueLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<HeatPoint>;
  /** Called with the point on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki öğede Enter / Space'e basılınca noktayla çağrılır. */
  onSelect?: ((p: HeatPoint) => void) | undefined;
  /** When the values change the cells fade to their new colors: `true` (a spring) or an easing name ("out", "spring-wobbly"…); default off. @tr Değerler değişince hücreler yeni renklerine geçer: `true` (yay) ya da bir easing adı ("out", "spring-wobbly"…); varsayılan kapalı. */
  animate?: Opt<boolean | string>;
}
interface Label { key: string; label: unknown }
interface HeatGrid { xs: Label[]; ys: Label[]; cells: HeatCell[] }
interface PosLabel { key: string; label: unknown; pos: number }

const DAY = 864e5;
const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
/** Short weekday names, Monday first, in the active locale. */
const weekdays = (): string[] => { const f = new Intl.DateTimeFormat(locale(), { weekday: "short" }); return [...Array(7)].map((_, i) => f.format(new Date(2024, 0, 1 + i))); };

/** Level 0 (empty / ≤ 0) … levels-1 for a value relative to `max`. */
export function heatLevel(v: number | null | undefined, max: number, levels = 5): number {
  if (v == null || !(v > 0) || !(max > 0)) return 0;
  return clamp(Math.ceil((v / max) * (levels - 1)), 1, levels - 1);
}

/** Heatmap. See docs/charts.md for props. */
export function Heatmap<D>(props: HeatmapProps<D>): Element {
  const size = useSize(props, 640, 0);
  const active = signal(-1);
  const tip = tooltipState();
  let svg: Element | null = null;

  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const levels = computed(() => num(read(props.levels)) ?? 5);
  // grid: { xs: [{key,label}], ys: [{key,label}], cells: [{key, xi, yi, value, label}] }
  const grid = computed((): HeatGrid => {
    const rows = rowsOf(props.data), gx = accessor<D>(props.x ?? "x"), gy = accessor<D>(props.y ?? "y"), gv = accessor<D>(props.value ?? "value");
    const cal = read(props.calendar);
    if (cal) return calendarGrid(rows, gx, gv, cal === true ? {} : cal, read(props.end));
    const xf = formatter(read<FormatSpec | null | undefined>(props.xFormat), String), yf = formatter(read<FormatSpec | null | undefined>(props.yFormat), String);
    const xd = read(props.xDomain) ?? [...new Set(rows.map((d, i) => gx(d, i)))];
    const yd = read(props.yDomain) ?? [...new Set(rows.map((d, i) => gy(d, i)))];
    const xi = new Map(xd.map((v, i) => [v, i])), yi = new Map(yd.map((v, i) => [v, i]));
    const sums = new Map<number, number>();
    rows.forEach((d, i) => {
      const a = xi.get(gx(d, i)), b = yi.get(gy(d, i));
      if (a == null || b == null) return;
      const k = b * xd.length + a, v = num(gv(d, i));
      if (v != null) sums.set(k, (sums.get(k) ?? 0) + v);
    });
    const cells: HeatCell[] = [];
    for (let b = 0; b < yd.length; b++) for (let a = 0; a < xd.length; a++) {
      const k = b * xd.length + a;
      cells.push({ key: `${String(xd[a])}|${String(yd[b])}`, xi: a, yi: b, value: sums.get(k) ?? null, label: `${yf(yd[b])} ${xf(xd[a])}` });
    }
    return { xs: xd.map((v) => ({ key: String(v), label: xf(v) })), ys: yd.map((v) => ({ key: String(v), label: yf(v) })), cells };
  });
  const max = computed(() => num(read(props.max)) ?? Math.max(0, ...grid().cells.map((c) => c.value ?? 0)));

  const ml = computed(() => Math.min(120, 8 + Math.max(0, ...grid().ys.map((y) => textWidth(y.label)))));
  const cell = computed(() => {
    const g = grid(), fixed = num(read(props.cell));
    return fixed ?? clamp((size.width() - ml() - 8) / Math.max(1, g.xs.length), 4, 32);
  });
  const height = computed(() => num(read(props.height)) ?? Math.ceil(22 + cell() * grid().ys.length + 4));
  const box = computed(() => ({ x: ml(), y: 22, w: cell() * grid().xs.length, h: cell() * grid().ys.length }));
  const gap = computed(() => (cell() > 8 ? 2 : 1));

  const xLabels = computed((): PosLabel[] => { const g = grid(), c = cell(); return thin(g.xs.map((x, i) => ({ ...x, i })), Math.max(2, Math.floor(box().w / 36))).map((x) => ({ key: x.key, label: x.label, pos: f1(box().x + x.i * c + c / 2) })); });
  const yLabels = computed((): PosLabel[] => { const c = cell(); return grid().ys.map((y, i) => ({ key: y.key, label: y.label, pos: f1(box().y + i * c + c / 2) })); });

  const pointAt = (k: number): HeatPoint | undefined => { const c = grid().cells[k]; return c && { index: k, x: (grid().xs[c.xi] as Label).label, y: (grid().ys[c.yi] as Label).label, value: c.value, label: c.label, datum: c }; };
  const show = (k: number): void => {
    active.set(k);
    const opt = read(props.tooltip), c = grid().cells[k];
    if (!c || opt === false) return void tip.at.set(null);
    const content = typeof opt === "function" ? () => opt(pointAt(k) as HeatPoint) : () => tipBody(c.label, [{ label: read(props.valueLabel) ?? "Value", value: c.value == null ? "—" : fmt()(c.value), index: 0 }]);
    showTip(tip, svg, size.width(), box().x + (c.xi + 0.5) * cell(), box().y + c.yi * cell(), content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const select = (k = active.peek()): void => { const p = pointAt(k); if (p) props.onSelect?.(p); };
  const onKeyDown = (e: KeyboardEvent): void => {
    const g = grid(), nx = g.xs.length, n = g.cells.length;
    if (!n) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const i = Math.max(0, active.peek());
    const moves: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + nx, ArrowUp: i - nx, Home: 0, End: n - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    show(active.peek() < 0 ? 0 : clamp(moves[e.key] as number, 0, n - 1));
  };

  const body = [
    h("g", { class: "m-chart-axis m-chart-axis-x", "aria-hidden": "true" },
      each<PosLabel>({ each: xLabels, key: (t) => t.key, children: (t) => h("text", { x: attr(() => t().pos), y: 14, "text-anchor": "middle" }, attr(() => t().label)) })),
    h("g", { class: "m-chart-axis m-chart-axis-y", "aria-hidden": "true" },
      each<PosLabel>({ each: yLabels, key: (t) => t.key, children: (t) => h("text", { x: () => f1(ml() - 6), y: attr(() => t().pos), dy: "0.32em", "text-anchor": "end" }, attr(() => t().label)) })),
    h("g", { class: "m-chart-plot", transform: attr(() => `translate(${f1(box().x)},${box().y})`), onPointerLeave: hide,
      // animate: the color change runs as a CSS transition (the easing's own curve and length; springs as linear())
      "class:m-heat-anim": () => !!read(props.animate),
      style: () => { const m = read(props.animate); if (!m) return null; const e = ease(m === true ? "spring" : m); return { "--m-heat-ease": cssOf(e) ?? "ease-out", "--m-heat-dur": `${Math.round(e.duration ?? 450)}ms` }; } },
      each<HeatCell>({ each: () => grid().cells, key: (c) => c.key, children: (c, i) => h("rect", {
        class: attr(() => `m-heat-cell m-heat-${heatLevel(c().value, max(), levels())}`), "class:m-chart-active": () => active() === i(),
        x: attr(() => f1(c().xi * cell())), y: attr(() => f1(c().yi * cell())), width: attr(() => f1(Math.max(1, cell() - gap()))), height: attr(() => f1(Math.max(1, cell() - gap()))), rx: 2,
        onPointerEnter: () => show(i()), onClick: () => select(i()),
      }) })),
  ];

  return Frame<Label>(props, {
    kind: "heatmap", size: { ...size, height }, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => grid().cells.length === 0, tip,
    table: {
      caption: () => read(props.title), rows: () => grid().ys,
      columns: () => { const g = grid(); return [{ label: "", value: (y: Label) => y.label }, ...g.xs.map((x, a) => ({ label: x.label, value: (_y: Label, b: number) => { const c = g.cells[b * g.xs.length + a]; return c?.value == null ? "" : fmt()(c.value); } }))]; },
    },
  });
}

/** Weeks (columns, oldest first) × weekdays (rows, Monday first) ending at `end` (default: latest date in the data). */
function calendarGrid<D>(rows: readonly D[], gx: Getter<D>, gv: Getter<D>, { weeks = 12 }: { weeks?: number }, endProp: unknown): HeatGrid {
  const byDay = new Map<string, number>();
  let last: Date | null = null;
  rows.forEach((d, i) => {
    const t = toDate(gx(d, i));
    if (!t) return;
    const v = num(gv(d, i));
    byDay.set(dayKey(t), (byDay.get(dayKey(t)) ?? 0) + (v ?? 0));
    if (!last || t > last) last = t;
  });
  const end = toDate(endProp) ?? (last as Date | null) ?? new Date();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const start = new Date(endDay);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);
  const xs: Label[] = [], cells: HeatCell[] = [], names = weekdays();
  for (let w = 0; w < weeks; w++) { const d = new Date(start); d.setDate(d.getDate() + w * 7); xs.push({ key: dayKey(d), label: applyPipe("date", d, { month: "short", day: "numeric" }) }); }
  for (let wd = 0; wd < 7; wd++) for (let w = 0; w < weeks; w++) {
    const d = new Date(start);
    d.setDate(d.getDate() + w * 7 + wd);
    const future = d.getTime() > endDay.getTime() + DAY / 2;
    cells.push({ key: dayKey(d), xi: w, yi: wd, value: future ? null : byDay.get(dayKey(d)) ?? 0, label: applyPipe("date", d), future });
  }
  return { xs, ys: names.map((n, i) => ({ key: String(i), label: n })), cells };
}
