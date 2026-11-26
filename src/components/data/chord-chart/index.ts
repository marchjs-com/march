// ChordChart: flows inside a group of things, drawn round (march/charts). Folder: src/components/data/chord-chart/.
// Each group is an arc on the rim as long as its total; ribbons through the middle join the groups that exchange
// something, as wide at each end as what goes that way. Directed flows end in an arrow. Arcs and ribbons open from
// zero angle, turn to new angles when the data changes and collapse when they go.
import "./chord-chart.css";
import { signal, computed, read, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, useSize, attr, navIndex, each, tween, presence, animateOf, textWidth, f1,
  type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp, type AnimateProp } from "../../../charts/util.ts";
import { Frame, tooltipState, showTip, tipBody } from "../../../charts/parts.ts";
import { TAU, polar, arcPath } from "../../../charts/arc.ts";
import { niceStep } from "../../../charts/scale.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import type { Handler } from "../../../core/util.ts";

messages("tr", { "Source": "Kaynak", "Target": "Hedef", "Value": "Değer", "Out": "Giden", "In": "Gelen", "Total": "Toplam" });

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** Point passed to `tooltip(point)` and `onSelect(point)`: a group (arc) or a ribbon. */
export interface ChordPoint<D> {
  /** What was hit: a group (arc) or a ribbon. */
  kind: "group" | "ribbon";
  /** The group name, or "source→target" for a ribbon. */
  key: string;
  /** Group name, or "A → B" ("A ↔ B" undirected) for a ribbon. */
  label: string;
  /** A group's total, or a ribbon's value from source to target. */
  value: number;
  /** A ribbon: the value the other way (undirected) or 0. A group: what flows in (directed) or its total. */
  back: number;
  /** A ribbon's source group. */
  source?: string | undefined;
  /** A ribbon's target group. */
  target?: string | undefined;
  /** The flow rows behind it (from `data`). */
  datum?: D | undefined;
}
export interface ChordChartProps<D = unknown> extends ChartBaseProps {
  /** A square matrix: `matrix[i][j]` is what group i gives group j (a signal or function works too). @tr Kare bir matris: `matrix[i][j]`, i grubunun j grubuna verdiği (sinyal ya da fonksiyon da olur). */
  matrix?: MaybeReactive<readonly (readonly (number | null | undefined)[])[] | null | undefined>;
  /** Group names in matrix order (default "1", "2"…); with `data` they fix the order of the groups. @tr Matris sırasıyla grup adları (varsayılan "1", "2"…); `data` ile grupların sırasını belirler. */
  names?: MaybeReactive<readonly string[] | null | undefined>;
  /** Instead of a matrix: flow rows like `{ source, target, value }` (an array, signal or function). @tr Matris yerine: `{ source, target, value }` gibi akış satırları (dizi, sinyal ya da fonksiyon). */
  data?: DataProp<D>;
  /** A flow row's source group: a key or getter (default "source"). @tr Akış satırının kaynak grubu: anahtar ya da getter (varsayılan "source"). */
  source?: Field<D> | undefined;
  /** A flow row's target group: a key or getter (default "target"). @tr Akış satırının hedef grubu: anahtar ya da getter (varsayılan "target"). */
  target?: Field<D> | undefined;
  /** A flow row's value: a key or getter (default "value"). @tr Akış satırının değeri: anahtar ya da getter (varsayılan "value"). */
  value?: Field<D> | undefined;
  /** Directed flows: a group's arc holds what it gives and gets, ribbons end in an arrow at the target (default false). @tr Yönlü akışlar: grubun yayı verdiğini ve aldığını taşır, şeritler hedefte okla biter (varsayılan false). */
  directed?: Opt<boolean>;
  /** Gap between groups in radians (default 0.04). @tr Gruplar arasındaki boşluk, radyan (varsayılan 0.04). */
  padAngle?: Opt<number>;
  /** Width of the group arcs in px (default 14). @tr Grup yaylarının kalınlığı, px (varsayılan 14). */
  thickness?: Opt<number>;
  /** Ribbon color: "source" (default), "target", or "larger" (the end that gives more). @tr Şerit rengi: "source" (varsayılan), "target" ya da "larger" (daha çok veren uç). */
  ribbonColor?: Opt<"source" | "target" | "larger">;
  /** Group names around the rim (default true). @tr Çemberin çevresinde grup adları (varsayılan true). */
  labels?: Opt<boolean>;
  /** Value ticks on the rim: `true` (a nice step) or a step in value units (default false). @tr Çemberde değer çentikleri: `true` (uygun adım) ya da değer biriminde adım (varsayılan false). */
  ticks?: Opt<boolean | number>;
  /** Value format for ticks, tooltip and table: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Çentik, araç ipucu ve tablo için değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Headers of the data table: `{ source, target, value }` (defaults "Source", "Target", "Value", translated). @tr Veri tablosu başlıkları: `{ source, target, value }` (varsayılanlar "Source", "Target", "Value", çevrilir). */
  tableLabels?: Opt<{ source?: string; target?: string; value?: string }>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<ChordPoint<D>>;
  /** Called with a group or ribbon on click, or Enter / Space on the focused one. @tr Bir gruba ya da şeride tıklanınca veya odaktakinde Enter / Space'e basılınca çağrılır. */
  onSelect?: Handler<[p: ChordPoint<D>]> | undefined;
  /** Change animation: `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or a function per mark. @tr Değişim animasyonu: `true` (varsayılan, yay), `false`, easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da işaret başına fonksiyon. */
  animate?: MaybeReactive<AnimateProp> | undefined;
}

interface Group { key: string; label: string; index: number; a0: number; a1: number; value: number; out: number; in: number; order: number }
interface Ribbon { key: string; i: number; j: number; si: number; ti: number; color: number; s0: number; s1: number; t0: number; t1: number; value: number; back: number; order: number }
interface Flow { i: number; j: number; value: number }

// data props: a value or any function returning one (a plain arrow too, not only a signal)
const call = <T>(v: T | (() => T)): T => (typeof v === "function" ? (v as () => T)() : v);
const f2 = (v: number): number => Math.round(v * 100) / 100;
const pt = (cx: number, cy: number, r: number, a: number): string => polar(cx, cy, r, a).map(f2).join(",");
const arcTo = (cx: number, cy: number, r: number, a0: number, a1: number): string => `A${f2(r)},${f2(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(cx, cy, r, a1)}`;
/** A ribbon between two spans of the circle, through the middle; `head` > 0 ends it in an arrow at the target. */
function ribbonPath(cx: number, cy: number, r: number, s0: number, s1: number, t0: number, t1: number, head = 0): string {
  const c = `${f2(cx)},${f2(cy)}`;
  let d = `M${pt(cx, cy, r, s0)}${arcTo(cx, cy, r, s0, s1)}`;
  if (head > 0) d += `Q${c} ${pt(cx, cy, r - head, t0)}L${pt(cx, cy, r, (t0 + t1) / 2)}L${pt(cx, cy, r - head, t1)}`;
  else if (s0 !== t0 || s1 !== t1) d += `Q${c} ${pt(cx, cy, r, t0)}${arcTo(cx, cy, r, t0, t1)}`;
  return `${d}Q${c} ${pt(cx, cy, r, s0)}Z`;
}

/** Chord diagram: groups on a ring, ribbons for the flows between them. See docs.md for props. */
export function ChordChart<D>(props: ChordChartProps<D>): Element {
  const size = useSize(props, 420, 360);
  const hidden = signal(new Set<string>()), active = signal(-1), lit = signal<number | null>(null);
  const tip = tooltipState();
  const how = (): AnimateProp => animateOf(props.animate as AnimateProp);
  let svg: Element | null = null;

  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  // groups and flows from the matrix or from flow rows
  const input = computed(() => {
    const names = [...(call(props.names) ?? [])].map(String);
    const flows: (Flow & { datum?: D })[] = [];
    if (props.data != null) {
      const rows = rowsOf(props.data), s = accessor<D>(props.source ?? "source"), tg = accessor<D>(props.target ?? "target"), v = accessor<D>(props.value ?? "value");
      const at = (k: string): number => { let i = names.indexOf(k); if (i < 0) { i = names.length; names.push(k); } return i; };
      rows.forEach((d, n) => { const a = String(s(d, n) ?? ""), b = String(tg(d, n) ?? ""), val = num(v(d, n)) ?? 0; if (a && b && val > 0) flows.push({ i: at(a), j: at(b), value: val, datum: d }); });
    } else {
      const m = call(props.matrix) ?? [];
      m.forEach((row, i) => row?.forEach((x, j) => { const val = num(x) ?? 0; if (val > 0 && j < m.length) flows.push({ i, j, value: val }); }));
      for (let i = names.length; i < m.length; i++) names.push(String(i + 1));
    }
    return { names, flows };
  });
  const layout = computed(() => {
    const { names, flows } = input(), off = hidden(), dir = read(props.directed) === true;
    const keep = names.map((k) => !off.has(k)), n = names.length;
    const m: number[][] = names.map(() => names.map(() => 0));
    for (const f of flows) if (keep[f.i] && keep[f.j]) m[f.i]![f.j]! += f.value;
    const totals = names.map((_, i) => (keep[i] ? m[i]!.reduce((a, b) => a + b, 0) + (dir ? m.reduce((a, row) => a + row[i]!, 0) : 0) : 0));
    const shown = totals.map((v, i) => (keep[i] && v > 0 ? i : -1)).filter((i) => i >= 0);
    const total = totals.reduce((a, b) => a + b, 0);
    let pad = Math.max(0, num(read(props.padAngle)) ?? 0.04);
    if (pad * shown.length >= TAU * 0.5) pad = (TAU * 0.5) / Math.max(1, shown.length);
    const k = total ? (TAU - pad * (shown.length > 1 ? shown.length : 0)) / total : 0;
    const groups: Group[] = [], outSpan = new Map<string, [number, number]>(), inSpan = new Map<string, [number, number]>();
    let a = 0;
    shown.forEach((i, o) => {
      const a0 = a;
      for (let j = 0; j < n; j++) {
        const vo = m[i]![j]!; outSpan.set(`${i}:${j}`, [a, a + vo * k]); a += vo * k;
        if (dir) { const vi = m[j]![i]!; inSpan.set(`${j}:${i}`, [a, a + vi * k]); a += vi * k; }
      }
      groups.push({ key: names[i]!, label: names[i]!, index: i, a0, a1: a, value: totals[i]!, out: m[i]!.reduce((x, y) => x + y, 0), in: m.reduce((x, row) => x + row[i]!, 0), order: o });
      a += shown.length > 1 ? pad : 0;
    });
    const ribbons: Ribbon[] = [];
    const color = read(props.ribbonColor) ?? "source";
    for (const i of shown) for (const j of shown) {
      if (dir ? !m[i]![j] : j < i || (!m[i]![j] && !m[j]![i])) continue;
      const s = outSpan.get(`${i}:${j}`)!, tt = dir ? inSpan.get(`${i}:${j}`)! : outSpan.get(`${j}:${i}`)!;
      const v = m[i]![j]!, back = dir ? 0 : m[j]![i]!;
      ribbons.push({ key: `${names[i]}→${names[j]}`, i, j, si: i, ti: j, color: color === "target" ? j : color === "larger" ? (back > v ? j : i) : i,
        s0: s[0], s1: s[1], t0: tt[0], t1: tt[1], value: v, back, order: 0 });
    }
    ribbons.sort((x, y) => x.s0 - y.s0).forEach((r, o) => { r.order = o; });
    return { groups, ribbons, names, k, dir, flows };
  });
  const geo = computed(() => {
    const w = size.width(), hh = size.height(), lab = read(props.labels) !== false, tk = !!read(props.ticks);
    const longest = Math.max(0, ...input().names.map((s) => textWidth(s, 6.6)));
    const mx = (lab ? Math.min(longest + 14, w / 4) : 6) + (tk ? 16 : 0), my = (lab ? 20 : 6) + (tk ? 16 : 0);
    const R = Math.max(10, Math.min((w - 2 * mx) / 2, (hh - 2 * my) / 2));
    const th = Math.min(R / 3, Math.max(2, num(read(props.thickness)) ?? 14));
    return { cx: w / 2, cy: hh / 2, R, r0: R - th, rr: R - th - 3, ticks: tk };
  });

  const groupPres = presence(() => layout().groups, (g) => g.key, how);
  const ribbonPres = presence(() => layout().ribbons, (r) => r.key, how);
  const count = (): number => layout().groups.length + layout().ribbons.length;

  const pointAt = (k: number): ChordPoint<D> | undefined => {
    const L = layout();
    if (k < L.groups.length) { const g = L.groups[k]; return g && { kind: "group", key: g.key, label: g.label, value: L.dir ? g.out : g.value, back: L.dir ? g.in : g.value }; }
    const r = L.ribbons[k - L.groups.length];
    if (!r) return undefined;
    const datum = L.flows.find((f) => (f as { datum?: D }).datum !== undefined && f.i === r.i && f.j === r.j) as { datum?: D } | undefined;
    return { kind: "ribbon", key: r.key, label: `${L.names[r.i]} ${L.dir ? "→" : "↔"} ${L.names[r.j]}`, value: r.value, back: r.back, source: L.names[r.i], target: L.names[r.j], datum: datum?.datum };
  };
  const show = (k: number): void => {
    active.set(k);
    const L = layout(), g = geo(), opt = read(props.tooltip), p = pointAt(k);
    lit.set(k < L.groups.length ? (L.groups[k]?.index ?? null) : null);
    if (!p || opt === false) return void tip.at.set(null);
    let mid: number, rad: number, rows;
    if (p.kind === "group") {
      const gr = L.groups[k]!; mid = (gr.a0 + gr.a1) / 2; rad = (g.R + g.r0) / 2;
      rows = L.dir ? [{ label: t`Out`, value: fmt()(gr.out), index: gr.index }, { label: t`In`, value: fmt()(gr.in), index: gr.index }]
        : [{ label: t`Total`, value: fmt()(gr.value), index: gr.index }];
    } else {
      const r = L.ribbons[k - L.groups.length]!; mid = (r.s0 + r.s1) / 2; rad = g.rr * 0.55;
      rows = [{ label: `${L.names[r.i]} → ${L.names[r.j]}`, value: fmt()(r.value), index: r.i }];
      if (!L.dir && r.back) rows.push({ label: `${L.names[r.j]} → ${L.names[r.i]}`, value: fmt()(r.back), index: r.j });
    }
    const [x, y] = polar(g.cx, g.cy, rad, mid);
    const content = typeof opt === "function" ? () => opt(p) : () => tipBody(p.kind === "group" ? p.label : null, rows, props.colors);
    showTip(tip, svg, size.width(), x, y, content);
  };
  const hide = (): void => { active.set(-1); lit.set(null); tip.at.set(null); };
  const select = (k = active.peek()): void => { const p = pointAt(k); if (p) props.onSelect?.(p); };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const k = navIndex(e.key, active.peek(), 0, count() - 1);
    if (k == null || !count()) return;
    e.preventDefault();
    show(k);
  };
  const groupAt = (key: string): number => layout().groups.findIndex((g) => g.key === key);
  const ribbonAt = (key: string): number => { const i = layout().ribbons.findIndex((r) => r.key === key); return i < 0 ? -1 : layout().groups.length + i; };
  const activeKey = (): string | undefined => { const k = active(), L = layout(); return k < 0 ? undefined : k < L.groups.length ? L.groups[k]?.key : L.ribbons[k - L.groups.length]?.key; };
  const style = (i: number): Record<string, string> | undefined => colorStyle(props.colors, i);
  const fromZero = <T extends object>(keys: readonly (keyof T)[]) => (to: T): T => { const o = { ...to } as Record<keyof T, unknown>; for (const k of keys) o[k] = 0; return o as T; };

  const ribbonLayer = h("g", { class: "m-chord-ribbons" },
    each<Ribbon & { leaving?: boolean }>({ each: ribbonPres.items, key: (r) => r.key, children: (r) => {
      const key = untrack(r).key;
      const a = tween(() => { const v = r(); if (!v.leaving) return v; const sm = (v.s0 + v.s1) / 2, tm = (v.t0 + v.t1) / 2; return { ...v, s0: sm, s1: sm, t0: tm, t1: tm }; },
        ["s0", "s1", "t0", "t1"], how, fromZero<Ribbon>(["s0", "s1", "t0", "t1"]),
        { index: () => r().order, key, leaving: () => !!r().leaving, onSettle: () => { if (untrack(r).leaving) ribbonPres.done(key); } });
      return h("path", {
        class: () => `m-chord-ribbon ${seriesClass(r().color)}`, style: () => style(r().color),
        "class:m-chord-on": () => { const l = lit(); return l != null && (r().i === l || r().j === l); },
        "class:m-chart-active": () => activeKey() === key,
        d: attr(() => { const v = a(), g = geo(); return v.s1 - v.s0 <= 1e-4 && v.t1 - v.t0 <= 1e-4 && v.s0 === 0 ? "" : ribbonPath(g.cx, g.cy, g.rr, v.s0, v.s1, v.t0, v.t1, layout().dir ? Math.min(12, g.rr * 0.08) : 0); }),
        onPointerEnter: () => { const k = ribbonAt(key); if (k >= 0) show(k); },
        onClick: () => select(ribbonAt(key)),
      });
    } }));

  const groupLayer = h("g", { class: "m-chord-groups" },
    each<Group & { leaving?: boolean }>({ each: groupPres.items, key: (g) => g.key, children: (gr) => {
      const key = untrack(gr).key;
      const a = tween(() => { const v = gr(); if (!v.leaving) return v; const mid = (v.a0 + v.a1) / 2; return { ...v, a0: mid, a1: mid }; },
        ["a0", "a1"], how, fromZero<Group>(["a0", "a1"]),
        { index: () => gr().order, key, leaving: () => !!gr().leaving, onSettle: () => { if (untrack(gr).leaving) groupPres.done(key); } });
      const tickList = (): { a: number; major: boolean; v: number }[] => {
        const tk = read(props.ticks), L = layout(), g = gr();
        if (!tk || !L.k) return [];
        const step = typeof tk === "number" && tk > 0 ? tk : niceStep(Math.max(...L.groups.map((x) => x.value)), 4) / 2;
        const span = a().a1 - a().a0, total = g.value, list = [];
        if (!(step > 0) || total / step > 200) return [];
        for (let v = 0, n = 0; v <= total + 1e-9; v += step, n++) list.push({ a: a().a0 + (total ? (v / total) * span : 0), major: n % 2 === 0, v });
        return list;
      };
      return h("g", {
        class: () => `m-chord-group ${seriesClass(gr().index)}`, style: () => style(gr().index),
        "class:m-chord-on": () => lit() === gr().index, "class:m-chart-active": () => activeKey() === key,
        onPointerEnter: () => { const k = groupAt(key); if (k >= 0) show(k); },
        onClick: () => select(groupAt(key)),
      },
      h("path", { class: "m-chord-arc", d: attr(() => { const v = a(), g = geo(); return arcPath(g.cx, g.cy, g.R, g.r0, v.a0, Math.max(v.a0, v.a1)); }) }),
      () => (read(props.ticks) ? h("g", { class: "m-chord-ticks", "aria-hidden": "true" }, () => tickList().map((tk) => {
        const g = geo(), [x1, y1] = polar(g.cx, g.cy, g.R + 1, tk.a), [x2, y2] = polar(g.cx, g.cy, g.R + (tk.major ? 6 : 3), tk.a);
        const [tx, ty] = polar(g.cx, g.cy, g.R + 13, tk.a);
        return [h("line", { x1: f1(x1), y1: f1(y1), x2: f1(x2), y2: f1(y2) }),
          tk.major && tk.v > 0 ? h("text", { class: "m-chord-tick-label", x: f1(tx), y: f1(ty), "text-anchor": "middle", "dominant-baseline": "middle" }, String(applyPipe("compact", tk.v))) : null];
      })) : null),
      () => (read(props.labels) === false ? null : h("text", {
        class: "m-chord-label", "dominant-baseline": "middle",
        x: attr(() => { const v = a(), g = geo(); return f1(polar(g.cx, g.cy, g.R + (g.ticks ? 26 : 8), (v.a0 + v.a1) / 2)[0]); }),
        y: attr(() => { const v = a(), g = geo(); return f1(polar(g.cx, g.cy, g.R + (g.ticks ? 26 : 8), (v.a0 + v.a1) / 2)[1]); }),
        "text-anchor": attr(() => { const s = Math.sin((a().a0 + a().a1) / 2); return Math.abs(s) < 0.15 ? "middle" : s > 0 ? "start" : "end"; }),
        opacity: attr(() => (a().a1 - a().a0 > 0.02 ? 1 : 0)),
      }, () => gr().label)));
    } }));

  const body = [h("g", { class: () => `m-chart-plot m-chord-plot${lit() != null ? " m-chord-focus" : ""}`, onPointerLeave: hide }, ribbonLayer, groupLayer)];

  return Frame<Flow>(props, {
    kind: "chord", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => !input().flows.length, tip,
    legend: { items: () => (read(props.legend) ? input().names.map((k, i) => ({ key: k, label: k, index: i })) : []), hidden },
    table: {
      caption: () => read(props.title), rows: () => input().flows,
      columns: () => { const l = read(props.tableLabels), names = input().names; return [
        { label: l?.source ?? t`Source`, value: (f: Flow) => names[f.i] },
        { label: l?.target ?? t`Target`, value: (f: Flow) => names[f.j] },
        { label: l?.value ?? t`Value`, value: (f: Flow) => fmt()(f.value) }]; },
    },
  });
}
