// Sparkline: a tiny trend line, column chart or win/loss strip without axes (march/charts). Folder:
// src/components/data/sparkline/; shared chart parts (scales, formats, motion) are in src/charts/.
import "./sparkline.css";
import { computed, read, signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { lttb } from "../../../charts/lttb.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, attr, each, type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, f1 } from "../../../charts/util.ts";
import { tween, presence, motionOf, animateOf, type AnimateProp } from "../../../charts/motion.ts";
import { animateValue } from "../../../motion/engine/value.ts";
import { reducedMotion } from "../../../motion/env.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** How a sparkline draws its values. */
export type SparklineVariant = "line" | "bar" | "winloss";

export interface SparklineProps<D = unknown> {
  /** Numbers, or objects read through `y`; an array, signal or function. @tr Sayılar ya da `y` ile okunan nesneler; dizi, sinyal veya fonksiyon. */
  data?: DataProp<D>;
  /** The value of an object row: a key or getter. @tr Nesne satırının değeri: bir anahtar ya da getter. */
  y?: Field<D> | undefined;
  /** "line" (default), "bar" (tiny columns) or "winloss" (up / down blocks for positive / negative values, a tick for 0). @tr "line" (varsayılan), "bar" (küçük sütunlar) ya da "winloss" (pozitif / negatif değerler için yukarı / aşağı bloklar, 0 için bir çizgi). */
  variant?: Opt<SparklineVariant>;
  /** Width in px (default 120). @tr px cinsinden genişlik (varsayılan 120). */
  width?: Opt<number | string>;
  /** Height in px (default 32). @tr px cinsinden yükseklik (varsayılan 32). */
  height?: Opt<number | string>;
  /** Value format used in the accessible summary. @tr Erişilebilir özette kullanılan değer biçimi. */
  format?: Opt<FormatSpec>;
  /** Include 0 in the value range (bars always do). @tr Değer aralığına 0'ı katar (çubuklar her zaman katar). */
  zero?: Opt<boolean>;
  /** Fill the area under the line. @tr Çizginin altını doldurur. */
  area?: Opt<boolean>;
  /** Marker on the last point of a line (default true; `false` hides it). @tr Çizginin son noktasındaki işaret (varsayılan true; `false` gizler). */
  dot?: Opt<boolean>;
  /** Palette slot of the series color (0-based, default 0). @tr Seri renginin palet sırası (0'dan başlar, varsayılan 0). */
  color?: Opt<number>;
  /** Colors overriding the palette (the first one is used). @tr Paleti geçersiz kılan renkler (ilki kullanılır). */
  colors?: ChartBaseProps["colors"];
  /** Accessible name, read before the summary. @tr Özetten önce okunan erişilebilir ad. */
  title?: Opt<string>;
  /** Accessible text when there is no data (default "No data"). @tr Veri yokken erişilebilir metin (varsayılan "No data"). */
  empty?: Opt<string>;
  /**
   * Change animation: the line morphs to new data (it slides when a value is appended or the window moves on), bars
   * grow in (with `stagger` one after another) and leaving bars shrink away. `true` (default: a spring), `false`, an
   * easing name or `{ duration, easing, stagger, delay, enter, update, exit }`.
   * @tr Değişim animasyonu: çizgi yeni veriye dönüşür (bir değer eklenince ya da pencere kayınca kayar), çubuklar
   * büyüyerek gelir (`stagger` ile sırayla) ve giden çubuklar küçülerek kaybolur. `true` (varsayılan: yay), `false`, bir
   * easing adı ya da `{ duration, easing, stagger, delay, enter, update, exit }`.
   */
  animate?: AnimateProp | (() => AnimateProp);
}

/** The target of a line: x and y per drawn point, the values (to tell an append or a moving window) and the baseline. */
interface Pts { xs: number[]; ys: number[]; raw: number[]; base: number; down: boolean }
interface Line { xs: number[]; ys: number[] }
/** One column or win/loss block. */
interface Block { key: string; i: number; x: number; y: number; w: number; h: number; kind: "pos" | "neg" | "tie" }

const lerpArr = (a: readonly number[], b: readonly number[], t: number): number[] => b.map((x, i) => (a[i] as number) + (x - (a[i] as number)) * t);
const eqArr = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
/** `a` stretched (or squeezed) to `n` points by linear interpolation along the index. */
const resample = (a: readonly number[], n: number): number[] => {
  const m = a.length;
  if (!m) return Array(n).fill(0);
  return Array.from({ length: n }, (_, i) => {
    const p = n === 1 ? 0 : (i * (m - 1)) / (n - 1), k = Math.floor(p), f = p - k;
    return (a[k] as number) + (((a[Math.min(m - 1, k + 1)] as number) - (a[k] as number)) * f);
  });
};
/** The start of a line morph from what is drawn (`from`, for the old values `prev`) to `to`: a moving window slides
 *  left, an appended value grows out of the last point, anything else is resampled to the new length. */
function startOf(from: Line, prev: Pts, to: Pts): Line {
  const n = to.xs.length, m = from.xs.length;
  if (!to.down && !prev.down && n > 2 && m === n && eqArr(prev.raw.slice(1), to.raw.slice(0, -1)) && !eqArr(prev.raw, to.raw))
    return { xs: [...from.xs.slice(1), to.xs[n - 1] as number], ys: [...from.ys.slice(1), from.ys[m - 1] as number] };
  if (!to.down && m && n === m + 1 && eqArr(prev.raw, to.raw.slice(0, -1)))
    return { xs: [...from.xs, from.xs[m - 1] as number], ys: [...from.ys, from.ys[m - 1] as number] };
  return m === n ? from : { xs: resample(from.xs, n), ys: resample(from.ys, n) };
}

/** The points a line is drawn with: the target at once, or (animated) a morph on the motion engine. */
function morph(target: () => Pts, how: () => AnimateProp): () => Line {
  const shown = signal<Line>(untrack(target));
  let prev: Pts | null = null, run: { cancel(): void } | null = null;
  effect(() => {
    const to = target(), from = untrack(shown), was = prev;
    prev = to;
    run?.cancel(); run = null;
    const m = untrack(() => motionOf(how(), { index: 0, key: "line", phase: was ? "update" : "enter" }));
    if (!m || reducedMotion() || !to.xs.length || (was && eqArr(from.xs, to.xs) && eqArr(from.ys, to.ys))) return void shown.set(to);
    // first drawing: the line rises from its baseline
    const a = was && from.xs.length ? startOf(from, was, to) : { xs: to.xs, ys: to.xs.map(() => to.base) };
    shown.set(a);
    run = untrack(() => animateValue(0, 1, { easing: m.easing, ...(m.duration != null ? { duration: m.duration } : {}), delay: m.delay,
      onUpdate: (k: number) => shown.set({ xs: lerpArr(a.xs, to.xs, k), ys: lerpArr(a.ys, to.ys, k) }), onComplete: () => shown.set(to) }));
  });
  onCleanup(() => run?.cancel());
  return shown;
}

/** Tiny trend line (or columns, or a win/loss strip) without axes. `data` = numbers or objects (`y` key/fn). */
export function Sparkline<D>(props: SparklineProps<D>): Element {
  const w = computed(() => num(read(props.width)) ?? 120), ht = computed(() => num(read(props.height)) ?? 32);
  const vals = computed(() => { const g = accessor(props.y); return rowsOf(props.data).map((d, i) => num(g(d, i))); });
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const variant = computed((): SparklineVariant => { const v = read(props.variant); return v === "bar" || v === "winloss" ? v : "line"; });
  const how = (): AnimateProp => animateOf(props.animate);
  const pts = computed((): Pts => {
    const v = vals(), W = w(), H = ht(), pad = 3;
    const at = (i: number): number => v[i] as number;
    const all = v.map((_, i) => i).filter((i) => v[i] != null);
    const idx = all.length > W * 2 ? lttb(all, Math.round(W * 2), (i) => i, at) : all;
    if (!idx.length) return { xs: [], ys: [], raw: [], base: H, down: false };
    let lo = Infinity, hi = -Infinity;
    for (const i of idx) { lo = Math.min(lo, at(i)); hi = Math.max(hi, at(i)); }
    if (read(props.zero)) lo = Math.min(lo, 0);
    const n = v.length - 1 || 1, sx = (i: number): number => f1(pad + (i / n) * (W - pad * 2));
    const sy = (x: number): number => f1(hi === lo ? H / 2 : H - pad - ((x - lo) / (hi - lo)) * (H - pad * 2));
    return { xs: idx.map(sx), ys: idx.map((i) => sy(at(i))), raw: idx.map(at), base: hi === lo ? H / 2 : sy(lo), down: idx.length < all.length };
  });
  const line = morph(() => (variant() === "line" ? pts() : { xs: [], ys: [], raw: [], base: 0, down: false }), how);
  const path = computed(() => { const { xs, ys } = line(); return xs.length ? `M${xs.map((x, i) => `${f1(x)},${f1(ys[i] as number)}`).join("L")}` : ""; });

  // bars and win/loss blocks: one rect per value, keyed by its place
  const base = computed(() => {
    const v = vals().filter((x): x is number => x != null), H = ht();
    if (variant() === "winloss") return H / 2;
    const lo = Math.min(0, ...v), hi = Math.max(0, ...v), pad = 2;
    return hi === lo ? H - pad : f1(H - pad - ((0 - lo) / (hi - lo)) * (H - pad * 2));
  });
  const blocks = computed((): Block[] => {
    const kind = variant();
    if (kind === "line") return [];
    const v = vals(), W = w(), H = ht(), pad = 2, n = v.length || 1, band = (W - pad * 2) / n, bw = Math.max(1, band * (kind === "winloss" ? 0.78 : 0.72));
    const nums = v.filter((x): x is number => x != null), lo = Math.min(0, ...nums), hi = Math.max(0, ...nums);
    const sy = (x: number): number => (hi === lo ? H - pad : H - pad - ((x - lo) / (hi - lo)) * (H - pad * 2));
    const y0 = base(), out: Block[] = [];
    v.forEach((x, i) => {
      if (x == null) return;
      const bx = f1(pad + i * band + (band - bw) / 2), bwf = f1(bw);
      if (kind === "winloss") {
        const bh = Math.max(1, H / 2 - pad - 1);
        out.push(x > 0 ? { key: String(i), i, x: bx, y: f1(H / 2 - 1 - bh), w: bwf, h: f1(bh), kind: "pos" }
          : x < 0 ? { key: String(i), i, x: bx, y: f1(H / 2 + 1), w: bwf, h: f1(bh), kind: "neg" }
            : { key: String(i), i, x: bx, y: f1(H / 2 - 0.75), w: bwf, h: 1.5, kind: "tie" });
      } else {
        const y = f1(sy(x));
        out.push(x >= 0 ? { key: String(i), i, x: bx, y, w: bwf, h: f1(Math.max(x ? 1 : 0, y0 - y)), kind: "pos" } : { key: String(i), i, x: bx, y: y0, w: bwf, h: f1(y - y0), kind: "neg" });
      }
    });
    return out;
  });
  const shownBlocks = presence(blocks, (b) => b.key, how);

  const summary = (): unknown => {
    const v = vals().filter((x): x is number => x != null), f = fmt();
    if (!v.length) return read(props.empty) ?? t`No data`;
    if (variant() === "winloss") {
      const won = v.filter((x) => x > 0).length, lost = v.filter((x) => x < 0).length, tie = v.length - won - lost;
      return `${t`${won} wins, ${lost} losses`}${tie ? t`, ${tie} ties` : ""}`;
    }
    return `${v.length} values, from ${f(v[0])} to ${f(v[v.length - 1])}, min ${f(Math.min(...v))}, max ${f(Math.max(...v))}`;
  };
  return h("svg", {
    class: () => `m-sparkline m-sparkline-${variant()} ${seriesClass(num(read(props.color)) ?? 0)}`, style: () => colorStyle(props.colors, 0),
    role: "img", "aria-label": () => (read(props.title) ? `${read(props.title)}: ${summary()}` : summary()),
    viewBox: () => `0 0 ${w()} ${ht()}`, width: w, height: ht, preserveAspectRatio: "none",
  },
  () => (variant() === "line" && read(props.area) ? h("path", { class: "m-chart-area", d: attr(() => { const p = path(), { xs } = line(); return p ? `${p}L${f1(xs[xs.length - 1] as number)},${ht()}L${f1(xs[0] as number)},${ht()}Z` : ""; }) }) : null),
  () => (variant() === "line" ? [
    h("path", { class: "m-chart-line", d: path }),
    h("circle", { class: "m-chart-marker", r: 2.5, visibility: () => (line().xs.length && read(props.dot) !== false ? "visible" : "hidden"),
      cx: attr(() => f1(line().xs.at(-1) ?? 0)), cy: attr(() => f1(line().ys.at(-1) ?? 0)) }),
  ] : null),
  each<Block & { leaving?: boolean }>({ each: shownBlocks.items, key: (b) => b.key, children: (b) => {
    const key = untrack(b).key;
    // a block grows out of the baseline (bars) or the middle line (win/loss), and shrinks back into it when it leaves
    const flat = (x: Block): Block => ({ ...x, y: base(), h: 0 });
    const g = tween(() => { const x = b(); return x.leaving ? flat(x) : x; }, ["x", "y", "w", "h"], how, flat,
      { index: () => b().i, key, leaving: () => !!b().leaving, onSettle: () => { if (untrack(b).leaving) shownBlocks.done(key); } });
    return h("rect", { class: () => `m-sparkline-block is-${b().kind}`, x: attr(() => f1(g().x)), y: attr(() => f1(g().y)), width: attr(() => f1(Math.max(0, g().w))), height: attr(() => f1(Math.max(0, g().h))), rx: 1 });
  } }));
}
