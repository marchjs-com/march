// Heatmap: a grid or calendar of intensities (march/charts). Folder: src/components/data/heatmap/; shared chart parts
// (scales, axes, tooltip, data table, formats, motion) are in src/charts/.
// Heatmap: x × y grid of cells colored by value level (`m-heat-0..4`), e.g. weekday × hour.
// `calendar` mode lays out daily values as weeks (columns) × weekdays (rows): the last N weeks, or a whole year from
// `from` to `to`, with month and weekday labels, gaps for days outside the range and a "less → more" legend.
import "./heatmap.css";
import { signal, computed, read, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { toDate } from "../../../core/pipes.ts";
import { locale, t } from "../../../core/i18n.ts";
import { firstDayOf } from "../../../core/date.ts";
import { rowsOf, accessor, formatter, num, useSize, attr, textWidth, each,
  type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type Getter, type TooltipProp, f1 } from "../../../charts/util.ts";
import { Frame, tooltipState, showTip, tipBody, thin } from "../../../charts/parts.ts";
import { tween, presence, motionOf, animateOf, type AnimateProp } from "../../../charts/motion.ts";
import { clamp, type Handler } from "../../../core/util.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import { ease, cssOf } from "../../../motion/engine/ease.ts";
import { reducedMotion } from "../../../motion/env.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** One heatmap cell (also the `datum` of a heatmap point). In calendar mode `date` is its day. */
export interface HeatCell { key: string; xi: number; yi: number; value: number | null; label: unknown; date?: Date; future?: boolean }
/** Point passed to `tooltip(point)` and `onSelect(point)` of a heatmap. */
export interface HeatPoint { index: number; x: unknown; y: unknown; value: number | null; label: unknown; datum: HeatCell }
/** Texts of the level legend. */
export interface HeatLegendLabels { less?: string; more?: string }
export interface HeatmapProps<D = unknown> extends ChartBaseProps {
  /** Rows: an array (or signal / function returning one) of objects. @tr Satırlar: nesnelerden oluşan bir dizi (ya da onu döndüren sinyal / fonksiyon). */
  data?: DataProp<D>;
  /** Column key or getter (default "x"); a date in calendar mode. @tr Sütun anahtarı ya da getter (varsayılan "x"); takvim modunda bir tarih. */
  x?: Field<D> | undefined;
  /** Row key or getter (default "y"). @tr Satır anahtarı ya da getter (varsayılan "y"). */
  y?: Field<D> | undefined;
  /** Cell value key or getter (default "value"); duplicates are summed. @tr Hücre değeri anahtarı ya da getter (varsayılan "value"); tekrar edenler toplanır. */
  value?: Field<D> | undefined;
  /** `true` or `{ weeks }` (default 12): columns are weeks, rows the days of the week (the locale's first day first). @tr `true` ya da `{ weeks }` (varsayılan 12): sütunlar haftalar, satırlar haftanın günleri (yerel ayarın ilk günüyle başlar). */
  calendar?: Opt<boolean | { weeks?: number }>;
  /** First day of the calendar (a date); with `to` a year view: 53 weeks for a year. Days before it are gaps. @tr Takvimin ilk günü (bir tarih); `to` ile yıl görünümü: bir yıl için 53 hafta. Ondan önceki günler boşluktur. */
  from?: Opt<unknown>;
  /** Last day of the calendar (default `end`, else the latest date in the data). Days after it are gaps. @tr Takvimin son günü (varsayılan `end`, yoksa verideki en son tarih). Ondan sonraki günler boşluktur. */
  to?: Opt<unknown>;
  /** Last day of the calendar (older name of `to`). @tr Takvimin son günü (`to`'nun eski adı). */
  end?: Opt<unknown>;
  /** First day of the week in calendar mode, 0 = Sunday … 6 = Saturday (default: the locale's, via Intl). @tr Takvim modunda haftanın ilk günü, 0 = Pazar … 6 = Cumartesi (varsayılan: yerel ayarınki, Intl ile). */
  firstDay?: Opt<number>;
  /** Month names over the weeks in calendar mode (default true). @tr Takvim modunda haftaların üstünde ay adları (varsayılan true). */
  months?: Opt<boolean>;
  /** Weekday names in calendar mode: `true` (default: Mon, Wed, Fri), "all" or `false`. @tr Takvim modunda gün adları: `true` (varsayılan: Pzt, Çar, Cum), "all" ya da `false`. */
  dayLabels?: Opt<boolean | "all">;
  /** The "less → more" level legend under the grid: `true`, `false` or `{ less, more }` texts (default on in calendar mode). @tr Izgaranın altındaki "az → çok" düzey açıklaması: `true`, `false` ya da `{ less, more }` metinleri (takvim modunda varsayılan açık). */
  levelLegend?: Opt<boolean | HeatLegendLabels>;
  /** Format of the column labels; in calendar mode the date in the tooltip (default the locale's long date). @tr Sütun etiketlerinin biçimi; takvim modunda araç ipucundaki tarih (varsayılan yerel ayarın uzun tarihi). */
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
  /** Size of a cell's square in px (default: fits the width, at most 30). @tr Bir hücre karesinin px cinsinden boyutu (varsayılan: genişliğe sığar, en çok 30). */
  cellSize?: Opt<number>;
  /** Space between cells in px (default 2; 1 for tiny cells). @tr Hücreler arası boşluk, px (varsayılan 2; çok küçük hücrelerde 1). */
  gap?: Opt<number>;
  /** Corner radius of a cell in px (default 2; half the size makes dots). @tr Hücre köşe yarıçapı, px (varsayılan 2; boyutun yarısı nokta yapar). */
  radius?: Opt<number>;
  /** Fixed cell pitch in px, gap included (older form of `cellSize` + `gap`). @tr px cinsinden sabit hücre adımı, boşluk dahil (`cellSize` + `gap`'in eski biçimi). */
  cell?: Opt<number>;
  /** Label of the value row in the tooltip (default "Value"). @tr Araç ipucundaki değer satırının etiketi (varsayılan "Value"). */
  valueLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<HeatPoint>;
  /** Called with the point on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki öğede Enter / Space'e basılınca noktayla çağrılır. */
  onSelect?: Handler<[p: HeatPoint]> | undefined;
  /**
   * Change animation: cells pop in when first drawn (`stagger` makes a diagonal wave), fade to their new tone when the
   * values change, glide when the calendar moves on and shrink away when they leave. `true` (default: a spring),
   * `false`, an easing name or `{ duration, easing, stagger, delay, enter, update, exit }`.
   * @tr Değişim animasyonu: hücreler ilk çizimde belirir (`stagger` çapraz bir dalga yapar), değerler değişince yeni
   * tonlarına geçer, takvim ilerleyince kayar ve çıkınca küçülerek kaybolur. `true` (varsayılan: yay), `false`, bir
   * easing adı ya da `{ duration, easing, stagger, delay, enter, update, exit }`.
   */
  animate?: AnimateProp | (() => AnimateProp);
}
interface Label { key: string; label: unknown; show?: boolean }
interface HeatGrid { xs: Label[]; ys: Label[]; cells: HeatCell[]; cal: boolean; months: { key: string; label: string; xi: number }[] }
interface PosLabel { key: string; label: unknown; pos: number }

const DAY = 864e5;
const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const dayStart = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Whole days from a to b (local midnights; DST safe). */
const daysBetween = (a: Date, b: Date): number => Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / DAY);

/** Level 0 (empty / ≤ 0) … levels-1 for a value relative to `max`. */
export function heatLevel(v: number | null | undefined, max: number, levels = 5): number {
  if (v == null || !(v > 0) || !(max > 0)) return 0;
  return clamp(Math.ceil((v / max) * (levels - 1)), 1, levels - 1);
}

/** Heatmap. See docs.md for props. */
export function Heatmap<D>(props: HeatmapProps<D>): Element {
  const size = useSize(props, 640, 0);
  const active = signal(-1);
  const tip = tooltipState();
  let svg: Element | null = null;
  const how = (): AnimateProp => animateOf(props.animate);

  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const levels = computed(() => num(read(props.levels)) ?? 5);
  const grid = computed((): HeatGrid => {
    const rows = rowsOf(props.data), gx = accessor<D>(props.x ?? "x"), gy = accessor<D>(props.y ?? "y"), gv = accessor<D>(props.value ?? "value");
    const cal = read(props.calendar);
    if (cal) {
      const loc = locale(), fd = num(read(props.firstDay));
      const xf = read<FormatSpec | null | undefined>(props.xFormat);
      const df = xf ? formatter(xf) : ((d: unknown) => new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(d as Date));
      return calendarGrid(rows, gx, gv, cal === true ? {} : cal, read(props.from), read(props.to) ?? read(props.end), fd != null ? ((fd % 7) + 7) % 7 : firstDayOf(loc), loc, df, read(props.dayLabels));
    }
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
    return { xs: xd.map((v) => ({ key: String(v), label: xf(v) })), ys: yd.map((v) => ({ key: String(v), label: yf(v) })), cells, cal: false, months: [] };
  });
  const max = computed(() => num(read(props.max)) ?? Math.max(0, ...grid().cells.map((c) => c.value ?? 0)));
  const at = computed(() => { const m = new Map<string, number>(); grid().cells.forEach((c, i) => m.set(c.key, i)); return m; });
  const byPos = computed(() => { const m = new Map<string, HeatCell>(); for (const c of grid().cells) m.set(`${c.xi},${c.yi}`, c); return m; });

  const showMonths = computed(() => grid().cal && read(props.months) !== false);
  const showX = computed(() => (grid().cal ? showMonths() : true));
  const legendOn = computed(() => { const l = read(props.levelLegend); return l == null ? grid().cal : l !== false; });
  const ml = computed(() => Math.min(120, 8 + Math.max(0, ...grid().ys.filter((y) => y.show !== false).map((y) => textWidth(y.label)))));
  const top = computed(() => (showX() ? 22 : 4));
  const pitch = computed(() => {
    const g = grid(), fixed = num(read(props.cellSize)), old = num(read(props.cell)), gp = num(read(props.gap));
    if (fixed != null) return fixed + (gp ?? (fixed > 6 ? 2 : 1));
    return old ?? clamp((size.width() - ml() - 8) / Math.max(1, g.xs.length), 4, 32);
  });
  const gap = computed(() => { const gp = num(read(props.gap)); return clamp(gp ?? (pitch() > 8 ? 2 : 1), 0, pitch() - 1); });
  const cs = computed(() => Math.max(1, pitch() - gap()));
  const rx = computed(() => clamp(num(read(props.radius)) ?? 2, 0, cs() / 2));
  const box = computed(() => ({ x: ml(), y: top(), w: pitch() * grid().xs.length, h: pitch() * grid().ys.length }));
  const height = computed(() => num(read(props.height)) ?? Math.ceil(box().y + box().h + 4 + (legendOn() ? 24 : 0)));

  const xLabels = computed((): PosLabel[] => {
    const g = grid(), c = pitch();
    if (g.cal) return showMonths() ? g.months.map((m) => ({ key: m.key, label: m.label, pos: f1(box().x + m.xi * c) })) : [];
    return thin(g.xs.map((x, i) => ({ ...x, i })), Math.max(2, Math.floor(box().w / 36))).map((x) => ({ key: x.key, label: x.label, pos: f1(box().x + x.i * c + c / 2) }));
  });
  const yLabels = computed((): PosLabel[] => { const c = pitch(); return grid().ys.flatMap((y, i) => (y.show === false ? [] : [{ key: y.key, label: y.label, pos: f1(box().y + i * c + c / 2) }])); });

  const pointAt = (k: number): HeatPoint | undefined => { const g = grid(), c = g.cells[k]; return c && { index: k, x: c.date ?? (g.xs[c.xi] as Label).label, y: (g.ys[c.yi] as Label).label, value: c.value, label: c.label, datum: c }; };
  const show = (k: number): void => {
    active.set(k);
    const opt = read(props.tooltip), c = grid().cells[k];
    if (!c || opt === false) return void tip.at.set(null);
    const content = typeof opt === "function" ? () => opt(pointAt(k) as HeatPoint) : () => tipBody(c.label, [{ label: read(props.valueLabel) ?? t`Value`, value: c.value == null ? "—" : fmt()(c.value), index: 0 }]);
    showTip(tip, svg, size.width(), box().x + (c.xi + 0.5) * pitch(), box().y + c.yi * pitch(), content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const select = (k = active.peek()): void => { const p = pointAt(k); if (p) props.onSelect?.(p); };
  const onKeyDown = (e: KeyboardEvent): void => {
    const g = grid(), n = g.cells.length;
    if (!n) return;
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const i = Math.max(0, active.peek());
    let to: number | undefined;
    if (e.key === "Home") to = 0;
    else if (e.key === "End") to = n - 1;
    else if (g.cal) {
      // calendar cells run day after day: ↑ ↓ one day, ← → one week (a column)
      const step: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
      if (e.key in step) to = clamp(i + (step[e.key] as number), 0, n - 1);
    } else {
      const c = g.cells[i] as HeatCell, d: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
      const m = d[e.key];
      if (m) { const nb = byPos().get(`${c.xi + m[0]},${c.yi + m[1]}`); to = nb ? at().get(nb.key) : i; }
    }
    if (to == null) return;
    e.preventDefault();
    show(active.peek() < 0 ? 0 : to);
  };

  // color changes run as a CSS transition with the `animate` easing and length (springs as linear()); entering,
  // moving and leaving cells tween on the motion engine
  const fade = computed(() => {
    const m = motionOf(how(), { index: 0, key: "", phase: "update" });
    if (!m || reducedMotion()) return null;
    const e = ease(m.easing);
    return { "--m-heat-ease": cssOf(e) ?? "ease-out", "--m-heat-dur": `${Math.round(m.duration ?? e.duration ?? 450)}ms` };
  });
  const shown = presence(() => grid().cells, (c) => c.key, how);

  const legend = (): unknown => {
    if (!legendOn()) return null;
    const l = read(props.levelLegend), labels = typeof l === "object" && l ? l : {}, n = levels(), s = Math.min(12, cs()), gp = 3;
    const less = labels.less ?? t`Less`, more = labels.more ?? t`More`;
    const right = box().x + box().w, y = box().y + box().h + 10, x0 = right - textWidth(more) - 6 - n * (s + gp);
    return h("g", { class: "m-heat-legend", "aria-hidden": "true" },
      h("text", { x: f1(x0 - 6), y: f1(y + s / 2), dy: "0.32em", "text-anchor": "end" }, less),
      [...Array(n)].map((_, i) => h("rect", { class: `m-heat-swatch m-heat-${Math.min(i, 4)}`, x: f1(x0 + i * (s + gp)), y: f1(y), width: s, height: s, rx: Math.min(rx(), s / 2) })),
      h("text", { x: f1(x0 + n * (s + gp) + 3), y: f1(y + s / 2), dy: "0.32em" }, more));
  };

  const body = [
    h("g", { class: "m-chart-axis m-chart-axis-x", "aria-hidden": "true" },
      each<PosLabel>({ each: xLabels, key: (t) => t.key, children: (t) => h("text", { x: attr(() => t().pos), y: 14, "text-anchor": () => (grid().cal ? "start" : "middle") }, attr(() => t().label)) })),
    h("g", { class: "m-chart-axis m-chart-axis-y", "aria-hidden": "true" },
      each<PosLabel>({ each: yLabels, key: (t) => t.key, children: (t) => h("text", { x: () => f1(ml() - 6), y: attr(() => t().pos), dy: "0.32em", "text-anchor": "end" }, attr(() => t().label)) })),
    h("g", { class: "m-chart-plot", transform: attr(() => `translate(${f1(box().x)},${box().y})`), onPointerLeave: hide,
      "class:m-heat-anim": () => !!fade(), style: () => fade() ?? { "--m-heat-ease": null, "--m-heat-dur": null } },
      each<HeatCell & { leaving?: boolean }>({ each: shown.items, key: (c) => c.key, children: (c) => {
        const key = untrack(c).key;
        // a cell pops in from its middle (stagger: a diagonal wave, column + row), glides in grid units when the
        // calendar moves on, and shrinks away when it leaves
        const g = tween(() => { const x = c(); return { xi: x.xi, yi: x.yi, s: x.leaving ? 0 : 1 }; }, ["xi", "yi", "s"], how, (to) => ({ ...to, s: 0 }),
          { index: () => { const x = untrack(c); return x.xi + x.yi; }, key, leaving: () => !!c().leaving, onSettle: () => { if (untrack(c).leaving) shown.done(key); } });
        const geo = (): { x: number; y: number; w: number } => { const d = g(), p = pitch(), s = clamp(d.s, 0, 1.2), w = cs() * s; return { x: d.xi * p + (cs() - w) / 2, y: d.yi * p + (cs() - w) / 2, w }; };
        return h("rect", {
          class: attr(() => `m-heat-cell m-heat-${Math.min(4, heatLevel(c().value, max(), levels()))}`), "class:m-chart-active": () => !c().leaving && active() === at().get(key),
          "class:is-leaving": () => !!c().leaving,
          x: attr(() => f1(geo().x)), y: attr(() => f1(geo().y)), width: attr(() => f1(Math.max(0, geo().w))), height: attr(() => f1(Math.max(0, geo().w))),
          rx: attr(() => f1(rx() * clamp(g().s, 0, 1))),
          onPointerEnter: () => { const i = at().get(key); if (i != null && !untrack(c).leaving) show(i); }, onClick: () => { const i = at().get(key); if (i != null && !untrack(c).leaving) select(i); },
        });
      } })),
    legend,
  ];

  return Frame<Label>(props, {
    kind: "heatmap", size: { ...size, height }, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => grid().cells.length === 0, tip,
    table: {
      caption: () => read(props.title), rows: () => grid().ys,
      columns: () => { const g = grid(), pos = byPos(); return [{ label: "", value: (y: Label) => y.label }, ...g.xs.map((x, a) => ({ label: x.label, value: (_y: Label, b: number) => { const c = pos.get(`${a},${b}`); return c?.value == null ? "" : fmt()(c.value); } }))]; },
    },
  });
}

/**
 * Weeks (columns, oldest first) × days of the week (rows, `firstDay` first). The range runs from `from` (default:
 * `weeks` whole weeks back) to `to` (default: the latest date in the data); days outside it are gaps (no cell). Cells
 * come in date order, so the keyboard can step by day.
 */
function calendarGrid<D>(rows: readonly D[], gx: Getter<D>, gv: Getter<D>, { weeks = 12 }: { weeks?: number }, fromProp: unknown, toProp: unknown,
  firstDay: number, loc: string, dateText: (d: unknown) => unknown, dayLabels: boolean | "all" | null | undefined): HeatGrid {
  const byDay = new Map<string, number>();
  let last: Date | null = null;
  rows.forEach((d, i) => {
    const t = toDate(gx(d, i));
    if (!t) return;
    const v = num(gv(d, i));
    byDay.set(dayKey(t), (byDay.get(dayKey(t)) ?? 0) + (v ?? 0));
    if (!last || t > last) last = t;
  });
  const end = dayStart(toDate(toProp) ?? (last as Date | null) ?? new Date());
  const wd = (d: Date): number => (d.getDay() - firstDay + 7) % 7;
  const weekOf = (d: Date): Date => { const s = new Date(d); s.setDate(s.getDate() - wd(s)); return s; };
  const fromDate = toDate(fromProp);
  const first = fromDate ? dayStart(fromDate) : (() => { const s = weekOf(end); s.setDate(s.getDate() - (Math.max(1, weeks) - 1) * 7); return s; })();
  const start = weekOf(first);
  const nWeeks = Math.max(1, Math.floor(daysBetween(start, end) / 7) + 1);
  const monthName = new Intl.DateTimeFormat(loc, { month: "short" }), shortDay = new Intl.DateTimeFormat(loc, { weekday: "short" });
  const xs: Label[] = [], cells: HeatCell[] = [], months: HeatGrid["months"] = [];
  let prevMonth = -1;
  for (let w = 0; w < nWeeks; w++) {
    const d = new Date(start);
    d.setDate(d.getDate() + w * 7);
    xs.push({ key: dayKey(d), label: new Intl.DateTimeFormat(loc, { month: "short", day: "numeric" }).format(d < first ? first : d) });
    // a month is named over the first week whose first drawn day is in it (not too close to the previous name)
    const shownDay = d < first ? first : d, m = shownDay.getMonth();
    if (m !== prevMonth) {
      const prev = months[months.length - 1];
      if (prev && w - prev.xi < 3) months.pop();
      months.push({ key: `${shownDay.getFullYear()}-${m}`, label: monthName.format(shownDay), xi: w });
      prevMonth = m;
    }
  }
  if (months.length > 1 && (months[1] as { xi: number }).xi - (months[0] as { xi: number }).xi < 3) months.shift();
  for (let k = daysBetween(start, first); ; k++) {
    const d = new Date(start);
    d.setDate(d.getDate() + k);
    if (d.getTime() > end.getTime()) break;
    cells.push({ key: dayKey(d), xi: Math.floor(k / 7), yi: wd(d), value: byDay.get(dayKey(d)) ?? 0, label: dateText(d), date: d });
  }
  // rows: the days of the week from `firstDay`; by default only Monday, Wednesday and Friday are named on the side
  const ys: Label[] = [...Array(7)].map((_, i) => {
    const day = (firstDay + i) % 7, ref = new Date(2024, 0, 7 + day); // 7 Jan 2024 was a Sunday
    return { key: String(day), label: shortDay.format(ref), show: dayLabels === false ? false : dayLabels === "all" ? true : day === 1 || day === 3 || day === 5 };
  });
  return { xs, ys, cells, cal: true, months };
}
