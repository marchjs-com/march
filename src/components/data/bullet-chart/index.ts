// BulletChart: a measure against its target and qualitative ranges, one row (or column) per measure (march/charts).
// Folder: src/components/data/bullet-chart/; shared chart parts (sizing, tooltip, legend, data table, motion) are in src/charts/.
// Rows are a keyed presence list (by label). Each row tweens one geometry along its value axis (range ends, bar,
// target, previous) and across it (its place), so a bar fills, the target slides, ranges resize and a leaving row fades out.
import "./bullet-chart.css";
import { signal, computed, read, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { niceTicks } from "../../../charts/scale.ts";
import { rowsOf, accessor, formatter, num, useSize, attr, textWidth, navIndex, each, tween, presence, animateOf, colorStyle, f1,
  type AnimateProp, type AnimateOptions, type MotionContext, type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp } from "../../../charts/util.ts";
import { Frame, tooltipState, showTip, tipBody } from "../../../charts/parts.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import type { Handler } from "../../../core/util.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** Point passed to `tooltip(point)` and `onSelect(point)` of a bullet chart. */
export interface BulletPoint<D> {
  /** Row index in `data`. */ index: number;
  datum: D; label: string; subtitle: string; value: number | null; target: number | null; previous: number | null;
  /** Range ends, ascending. */ ranges: number[];
  /** Name of the range the value falls in (null without ranges or value). */ range: string | null;
}
export interface BulletChartProps<D = unknown> extends ChartBaseProps {
  /** Rows, one measure each (or a single object): an array (or signal / function returning one). @tr Satırlar, her biri bir ölçü (ya da tek bir nesne): bir dizi (ya da onu döndüren sinyal / fonksiyon). */
  data?: DataProp<D> | D | (() => D);
  /** Row name: a key or getter (default "label"). @tr Satır adı: bir anahtar ya da getter (varsayılan "label"). */
  label?: Field<D> | undefined;
  /** Smaller line under the name: a key or getter (default "subtitle"). @tr Adın altındaki küçük satır: bir anahtar ya da getter (varsayılan "subtitle"). */
  subtitle?: Field<D> | undefined;
  /** The measure (the bar): a key or getter (default "value"). @tr Ölçü (çubuk): bir anahtar ya da getter (varsayılan "value"). */
  value?: Field<D> | undefined;
  /** The target (the tick): a key or getter (default "target"). @tr Hedef (çizgi): bir anahtar ya da getter (varsayılan "target"). */
  target?: Field<D> | undefined;
  /** A comparative measure such as last period (a thin marker): a key or getter (default "previous"). @tr Geçen dönem gibi karşılaştırma ölçüsü (ince işaret): bir anahtar ya da getter (varsayılan "previous"). */
  previous?: Field<D> | undefined;
  /** Qualitative range ends, ascending (poor / ok / good…): a key or getter giving an array (default "ranges"), or one array for every row. @tr Nitel aralık uçları, artan sırada (zayıf / orta / iyi…): dizi veren bir anahtar ya da getter (varsayılan "ranges") ya da her satır için tek bir dizi. */
  ranges?: Field<D> | readonly number[] | undefined;
  /** Names of the ranges for tooltip and table (default "Poor", "Satisfactory", "Good"). @tr Araç ipucu ve tablo için aralık adları (varsayılan "Poor", "Satisfactory", "Good"). */
  rangeLabels?: Opt<readonly string[]>;
  /** "neutral" (default: shades of gray) or "traffic" (bad / warning / good tints). @tr "neutral" (varsayılan: gri tonları) ya da "traffic" (kötü / uyarı / iyi tonları). */
  rangeTone?: Opt<"neutral" | "traffic">;
  /** Low end of every scale (default 0). @tr Her ölçeğin alt ucu (varsayılan 0). */
  min?: Opt<number>;
  /** High end of the scale: a number, or a key / getter per row (default the largest of ranges, value, target and previous, rounded). @tr Ölçeğin üst ucu: bir sayı ya da satır başına anahtar / getter (varsayılan aralıklar, değer, hedef ve öncekinin en büyüğü, yuvarlanmış). */
  max?: Opt<number> | Field<D>;
  /** One scale for every row instead of one per row. @tr Her satıra ayrı ölçek yerine hepsine tek ölçek. */
  sharedScale?: Opt<boolean>;
  /** "horizontal" (default: rows, bars to the right) or "vertical" (columns, bars upwards). @tr "horizontal" (varsayılan: satırlar, çubuklar sağa) ya da "vertical" (sütunlar, çubuklar yukarı). */
  orientation?: Opt<"horizontal" | "vertical">;
  /** Thin rows without subtitles and ticks, for tables and lists. @tr Tablolar ve listeler için alt yazısız, çentiksiz ince satırlar. */
  compact?: Opt<boolean>;
  /** Tick values along each scale (default true; off in compact). @tr Her ölçek boyunca çentik değerleri (varsayılan true; compact'ta kapalı). */
  axis?: Opt<boolean>;
  /** The formatted value beside the bar (default true). @tr Çubuğun yanında biçimlenmiş değer (varsayılan true). */
  showValue?: Opt<boolean>;
  /** Row names and subtitles (default true). @tr Satır adları ve alt yazıları (varsayılan true). */
  names?: Opt<boolean>;
  /** Height of one row in px (default 58; 42 without axis; 26 compact). @tr Bir satırın yüksekliği, px (varsayılan 58; eksensiz 42; compact 26). */
  rowHeight?: Opt<number>;
  /** Bar color: a theme token ("primary", "success", "brand-blue"…) or a CSS color (default the accent). @tr Çubuk rengi: tema belirteci ("primary", "success", "brand-blue"…) ya da CSS rengi (varsayılan vurgu rengi). */
  color?: Opt<string>;
  /** Value format for ticks, labels, tooltip and table (default "number"). @tr Çentikler, yazılar, araç ipucu ve tablo için değer biçimi (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Header of the name column in the data table (default "Measure"). @tr Veri tablosundaki ad sütununun başlığı (varsayılan "Measure"). */
  xLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<BulletPoint<D>>;
  /** Called with the row on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki satırda Enter / Space'e basılınca satırla çağrılır. */
  onSelect?: Handler<[p: BulletPoint<D>]> | undefined;
  /** Motion: the bar fills to its value, the target slides, ranges fade in and resize, leaving rows shrink. `true` (default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. @tr Hareket: çubuk değerine dolar, hedef kayar, aralıklar belirip boyut değiştirir, çıkan satırlar küçülür. `true` (varsayılan), `false`, bir easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da `(ctx) => …`. */
  animate?: MaybeReactive<AnimateProp>;
}

interface Row<D> { key: string; label: string; subtitle: string; index: number; position: number; value: number | null; target: number | null; previous: number | null; ranges: number[]; lo: number; hi: number; ticks: number[]; datum: D }
/** Row geometry: c = place across, r = range ends, bar / tgt / prev along the value axis (px from its start), op = opacity. */
interface Geo { c: number; r: number[]; bar: number; tgt: number; prev: number; op: number }
const MARKS = ["value", "target", "previous"] as const;

const NAMED: Record<string, string> = { good: "var(--m-chart-good)", bad: "var(--m-chart-bad)", neutral: "var(--m-chart-muted)" };
/** A theme token ("brand-blue", "--my-var") or a CSS color as a CSS value. */
const tok = (c: string): string => NAMED[c] ?? (c.startsWith("--") ? `var(${c})` : /^[a-z]+(-[a-z0-9]+)*$/.test(c) && !/^(white|black|red|green|blue|orange|purple|gray|grey|transparent|gold|pink|teal|navy)$/.test(c) ? `var(--m-${c})` : c);
/** Rows fill one after another on the first draw, then a plain spring. */
const FILL = (c: MotionContext): AnimateOptions | boolean => (c.phase === "enter" ? { stagger: 80 } : true);

/** Bullet chart. See docs.md for props. */
export function BulletChart<D>(props: BulletChartProps<D>): Element {
  const hidden = signal(new Set<string>()), active = signal(-1);
  const tip = tooltipState();
  let svg: Element | null = null;
  const how = (): AnimateProp => { const a = animateOf(props.animate as AnimateProp); return a === undefined || a === true ? FILL : a; };

  const rows = computed((): D[] => {
    const v = typeof props.data === "function" ? (props.data as () => unknown)() : props.data;
    return v && typeof v === "object" && !(Symbol.iterator in v) ? [v as D] : rowsOf(v as DataProp<D>);
  });
  const vertical = computed(() => read(props.orientation) === "vertical");
  const compact = computed(() => !!read(props.compact));
  const showAxis = computed(() => !compact() && (read(props.axis) ?? true));
  const showNames = computed(() => read(props.names) ?? true);
  const rowH = computed(() => num(read(props.rowHeight)) ?? (compact() ? 26 : showAxis() ? 58 : 42));
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const size = useSize({ width: props.width, height: computed(() => read(props.height) ?? (vertical() ? 260 : rows().length * rowH() + 8)) }, 560, 200);

  const items = computed((): Row<D>[] => {
    const lab = accessor<D>(props.label ?? "label"), sub = accessor<D>(props.subtitle ?? "subtitle"), val = accessor<D>(props.value ?? "value");
    const tg = accessor<D>(props.target ?? "target"), pv = accessor<D>(props.previous ?? "previous");
    const rg = Array.isArray(props.ranges) ? (() => props.ranges) : accessor<D>((props.ranges as Field<D> | undefined) ?? "ranges");
    const mx = read(props.max as Opt<number>), mxf = typeof mx === "number" || mx == null ? null : accessor<D>(mx as Field<D>);
    const lo = num(read(props.min)) ?? 0, seen = new Set<string>();
    const list = rows().map((d, i) => {
      const r = rg(d, i), ranges = (Array.isArray(r) ? r : []).map(num).filter((x): x is number => x != null).sort((a, b) => a - b);
      const value = num(val(d, i)), target = num(tg(d, i)), previous = num(pv(d, i));
      const top = (mxf ? num(mxf(d, i)) : num(mx)) ?? Math.max(lo, ...ranges, value ?? lo, target ?? lo, previous ?? lo);
      let key = String(lab(d, i) ?? "");
      for (let n = 2; seen.has(key); n++) key = `${String(lab(d, i) ?? "")}#${n}`;
      seen.add(key);
      return { key, label: String(lab(d, i) ?? ""), subtitle: String(sub(d, i) ?? ""), index: i, position: i, value, target, previous, ranges, lo, hi: top, ticks: [] as number[], datum: d };
    });
    const count = vertical() ? 5 : 4;
    if (read(props.sharedScale)) {
      const n = niceTicks(lo, Math.max(lo + 1e-9, ...list.map((x) => x.hi)), count);
      return list.map((x) => ({ ...x, hi: mxf || num(mx) != null ? x.hi : n.max, ticks: n.ticks }));
    }
    return list.map((x) => { if (mxf || num(mx) != null) return { ...x, ticks: niceTicks(lo, x.hi, count).ticks.filter((v) => v <= x.hi) }; const n = niceTicks(lo, Math.max(lo + 1e-9, x.hi), count); return { ...x, hi: n.max, ticks: n.ticks }; });
  });
  const pres = presence(items, (r) => r.key, how);

  // frame: label column, value column, length of a value axis, thickness of a range band
  const frame = computed(() => {
    const W = size.width(), H = size.height(), list = items(), f = fmt();
    const valW = read(props.showValue) ?? true ? 12 + Math.max(0, ...list.map((r) => textWidth(r.value == null ? "" : f(r.value), 7))) : 8;
    if (vertical()) {
      const n = Math.max(1, list.length), col = (W - 8) / n, bottom = showNames() ? (compact() ? 22 : 38) : 8, top = read(props.showValue) ?? true ? 24 : 8;
      return { lw: 0, along0: H - bottom, len: Math.max(10, H - top - bottom), col, T: Math.min(col * (compact() ? 0.6 : 0.42), 40), valW, top };
    }
    const lw = showNames() ? Math.min(200, 16 + Math.max(0, ...list.map((r) => Math.max(textWidth(r.label, 7), compact() ? 0 : textWidth(r.subtitle, 6))))) : 6;
    const T = compact() ? Math.max(6, rowH() - 8) : Math.max(8, Math.min(26, rowH() - (showAxis() ? 30 : 14)));
    return { lw, along0: lw, len: Math.max(10, W - lw - valW - 6), col: rowH(), T, valW, top: 4 };
  });
  const px = (r: Row<D>, v: number | null): number => { const span = r.hi - r.lo || 1; return v == null ? 0 : Math.max(0, Math.min(1, (v - r.lo) / span)) * frame().len; };
  const layout = computed(() => {
    const out = new Map<string, Geo>(), fr = frame(), off = hidden();
    for (const r of items()) out.set(r.key, {
      c: vertical() ? 4 + r.position * fr.col : fr.top + r.position * fr.col,
      r: r.ranges.map((v) => px(r, v)), bar: off.has("value") ? 0 : px(r, r.value), tgt: px(r, r.target), prev: px(r, r.previous), op: 1,
    });
    return out;
  });
  // place in the svg: along the value axis (a px offset) and across it (offset inside the row)
  const at = (along: number, across: number): [number, number] => { const fr = frame(); return vertical() ? [across, fr.along0 - along] : [fr.along0 + along, across]; };
  const bandStart = (c: number): number => { const fr = frame(); return vertical() ? c + (fr.col - fr.T) / 2 : c + (compact() ? 4 : 6); };
  const rect = (a0: number, a1: number, c0: number, th: number): Record<string, number> => {
    const [x0, y0] = at(Math.min(a0, a1), c0), lenA = Math.abs(a1 - a0);
    return vertical() ? { x: f1(x0), y: f1(y0 - lenA), width: f1(th), height: f1(lenA) } : { x: f1(x0), y: f1(y0), width: f1(lenA), height: f1(th) };
  };
  const tick = (along: number, c0: number, th: number): Record<string, number> => {
    const [x1, y1] = at(along, c0), [x2, y2] = at(along, c0 + th);
    return { x1: f1(x1), y1: f1(y1), x2: f1(x2), y2: f1(y2) };
  };
  const markColors = computed(() => { const c = read(props.colors) ?? []; return [read(props.color) ?? c[0], c[1], c[2]].map((x) => (x ? tok(String(x)) : "")); });
  const shade = (k: number, m: number): Record<string, string> => {
    if (read(props.rangeTone) === "traffic") return { "--m-bullet-range": k === 0 ? "var(--m-chart-bad)" : k === m - 1 ? "var(--m-chart-good)" : "var(--m-warn, #d08a00)", "--m-bullet-shade": "24%" };
    return { "--m-bullet-shade": `${Math.round(m < 2 ? 14 : 26 - (18 * k) / (m - 1))}%` };
  };
  const rangeNames = (m: number): readonly string[] => read(props.rangeLabels) ?? (m === 3 ? [t`Poor`, t`Satisfactory`, t`Good`] : Array.from({ length: m }, (_, k) => `${t`Range`} ${k + 1}`));
  const rangeOf = (r: Row<D>): string | null => { if (r.value == null || !r.ranges.length) return null; const k = r.ranges.findIndex((e) => (r.value as number) <= e); return rangeNames(r.ranges.length)[k < 0 ? r.ranges.length - 1 : k] ?? null; };

  const pointAt = (r: Row<D> | undefined): BulletPoint<D> | undefined => r && { index: r.index, datum: r.datum, label: r.label, subtitle: r.subtitle, value: r.value, target: r.target, previous: r.previous, ranges: r.ranges, range: rangeOf(r) };
  const show = (k: number): void => {
    active.set(k);
    const opt = read(props.tooltip), r = items()[k], g = r && layout().get(r.key);
    if (!r || !g || opt === false) return void tip.at.set(null);
    const p = pointAt(r) as BulletPoint<D>, f = fmt(), fr = frame(), off = hidden();
    const content = typeof opt === "function" ? () => opt(p) : () => tipBody(r.subtitle ? `${r.label} · ${r.subtitle}` : r.label, [
      ...(r.value != null && !off.has("value") ? [{ label: t`Value`, value: f(r.value), index: 0 }] : []),
      ...(r.target != null && !off.has("target") ? [{ label: t`Target`, value: f(r.target), index: 1 }] : []),
      ...(r.previous != null && !off.has("previous") ? [{ label: t`Previous`, value: f(r.previous), index: 2 }] : []),
      ...(p.range ? [{ label: t`Range`, value: p.range, index: 3 }] : []),
    ], markColors);
    const [x, y] = at(Math.max(g.bar, g.tgt), bandStart(g.c) + fr.T / 2);
    showTip(tip, svg, size.width(), x, y, content);
  };
  const hide = (): void => { active.set(-1); tip.at.set(null); };
  const select = (k = active.peek()): void => { const p = pointAt(items()[k]); if (p) props.onSelect?.(p); };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const k = navIndex(e.key, active.peek(), 0, items().length - 1);
    if (k == null || !items().length) return;
    e.preventDefault();
    show(k);
  };
  const activeKey = (): string | undefined => items()[active()]?.key;

  const last = new Map<string, Geo>();
  const body = [
    h("g", { class: "m-chart-plot", onPointerLeave: hide },
      each<Row<D> & { leaving?: boolean }>({ each: pres.items, key: (r) => r.key, children: (r) => {
        const key = untrack(r).key;
        const target = (): Geo => {
          const row = r(), now = row.leaving ? undefined : layout().get(row.key);
          if (now) { last.set(row.key, now); return now; }
          const l = last.get(row.key) ?? { c: 0, r: [], bar: 0, tgt: 0, prev: 0, op: 0 };
          return { ...l, bar: 0, op: 0 };
        };
        const g = tween(target, ["c", "r", "bar", "tgt", "prev", "op"], how, (to) => ({ ...to, r: to.r.map(() => 0), bar: 0, tgt: 0, prev: 0, op: 0 }),
          { index: () => r().position, key, leaving: () => !!r().leaving, onSettle: () => { if (untrack(r).leaving) { last.delete(key); pres.done(key); } } });
        const b0 = (): number => bandStart(g().c);
        const k = (): number => items().findIndex((x) => x.key === key);
        const mid = (): number => b0() + frame().T / 2;
        return h("g", { class: "m-bullet-row", "class:m-chart-active": () => activeKey() === key, "class:m-bullet-leaving": () => !!r().leaving,
          opacity: attr(() => f1(Math.max(0, Math.min(1, g().op)))),
          onPointerEnter: () => { if (k() >= 0) show(k()); }, onClick: () => { if (k() >= 0) select(k()); } },
        h("rect", { class: "m-bullet-hit", x: attr(() => (vertical() ? f1(g().c) : 0)), y: attr(() => (vertical() ? 0 : f1(g().c))),
          width: attr(() => (vertical() ? f1(frame().col) : f1(size.width()))), height: attr(() => (vertical() ? size.height() : f1(frame().col))) }),
        h("g", { class: "m-bullet-ranges" }, each<number>({ each: computed(() => g().r.map((_, i) => i), { equals: (a, b) => !!a && !!b && a.length === b.length }), key: (i) => i, children: (i) => h("rect", {
          class: `m-bullet-range m-bullet-range-${untrack(i)}`, style: () => shade(i(), g().r.length),
          ...Object.fromEntries((["x", "y", "width", "height"] as const).map((p) => [p, attr(() => { const all = g().r, k = i(); return rect(k ? (all[k - 1] as number) : 0, all[k] ?? 0, b0(), frame().T)[p]; })])) }) })),
        h("rect", { class: "m-bullet-bar", style: () => colorStyle(markColors, 0), ...Object.fromEntries((["x", "y", "width", "height"] as const).map((p) => [p, attr(() => {
          const T = frame().T, th = T * (compact() ? 0.5 : 0.38);
          return rect(0, Math.max(0, g().bar), b0() + (T - th) / 2, th)[p];
        })])) }),
        () => (r().previous == null || hidden().has("previous") ? null : h("line", { class: "m-bullet-prev", style: () => { const c = markColors()[2]; return c ? { "--m-bullet-previous": c } : undefined; }, ...Object.fromEntries((["x1", "y1", "x2", "y2"] as const).map((p) => [p, attr(() => tick(g().prev, b0() + frame().T * 0.22, frame().T * 0.56)[p])])) })),
        () => (r().target == null || hidden().has("target") ? null : h("line", { class: "m-bullet-target", style: () => { const c = markColors()[1]; return c ? { "--m-bullet-target": c } : undefined; }, ...Object.fromEntries((["x1", "y1", "x2", "y2"] as const).map((p) => [p, attr(() => tick(g().tgt, b0() + frame().T * 0.1, frame().T * 0.8)[p])])) })),
        () => (showAxis() ? h("g", { class: "m-bullet-ticks", "aria-hidden": "true" }, () => r().ticks.map((v) => {
          const [x, y] = at(px(r(), v), vertical() ? b0() - 4 : b0() + frame().T + 12);
          return h("text", { class: "m-bullet-tick", x: f1(x), y: f1(y), "text-anchor": vertical() ? "end" : "middle", "dominant-baseline": vertical() ? "central" : "auto" }, String(fmt()(v)));
        })) : null),
        () => (showNames() ? h("g", { class: "m-bullet-names" },
          h("text", { class: "m-bullet-name", "text-anchor": () => (vertical() ? "middle" : "end"), "dominant-baseline": "central",
            x: attr(() => f1(vertical() ? g().c + frame().col / 2 : frame().lw - 10)),
            y: attr(() => f1(vertical() ? frame().along0 + 12 : mid() - (r().subtitle && !compact() ? 7 : 0))) }, () => r().label),
          () => (r().subtitle && !compact() ? h("text", { class: "m-bullet-sub", "text-anchor": () => (vertical() ? "middle" : "end"), "dominant-baseline": "central",
            x: attr(() => f1(vertical() ? g().c + frame().col / 2 : frame().lw - 10)),
            y: attr(() => f1(vertical() ? frame().along0 + 27 : mid() + 8)) }, () => r().subtitle) : null)) : null),
        () => (read(props.showValue) ?? true ? h("text", { class: "m-bullet-value", "text-anchor": () => (vertical() ? "middle" : "start"), "dominant-baseline": "central",
          x: attr(() => f1(vertical() ? g().c + frame().col / 2 : frame().lw + frame().len + 8)),
          y: attr(() => f1(vertical() ? frame().top - 12 : mid())) }, () => (r().value == null ? "" : String(fmt()(r().value)))) : null));
      } })),
  ];

  const frameProps = Object.create(props, { colors: { get: () => markColors } }) as ChartBaseProps;
  return Frame<Row<D>>(frameProps, {
    kind: "bullet", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => rows().length === 0, tip,
    legend: { items: () => (read(props.legend) ? [{ key: "value", label: t`Value`, index: 0 }, { key: "target", label: t`Target`, index: 1 }, { key: "previous", label: t`Previous`, index: 2 }]
      .filter((m) => items().some((r) => r[m.key as (typeof MARKS)[number]] != null)) : []), hidden },
    table: {
      caption: () => read(props.title), rows: items,
      columns: () => [{ label: read(props.xLabel) ?? t`Measure`, value: (r: Row<D>) => (r.subtitle ? `${r.label} (${r.subtitle})` : r.label) },
        { label: t`Value`, value: (r: Row<D>) => (r.value == null ? "" : fmt()(r.value)) },
        { label: t`Target`, value: (r: Row<D>) => (r.target == null ? "" : fmt()(r.target)) },
        { label: t`Previous`, value: (r: Row<D>) => (r.previous == null ? "" : fmt()(r.previous)) },
        { label: t`Range`, value: (r: Row<D>) => rangeOf(r) ?? "" }],
    },
  });
}
