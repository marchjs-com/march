// CandlestickChart: prices over time as candles, OHLC bars or a close line (march/charts). Folder:
// src/components/data/candlestick-chart/; shared chart parts (scales, axes, tooltip, data table, marks, navigator,
// sync, motion) are in src/charts/.
// Display only. Every candle is keyed by its x; it grows from its open price, morphs on a change and shrinks away when
// it leaves. The x / y domains tween, so a live append slides the candles left while the new one grows in.
import "./candlestick-chart.css";
import { signal, computed, read, untrack, effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { scaleLinear, timeTicks } from "../../../charts/scale.ts";
import { rowsOf, accessor, formatter, num, xKind, timeMs, timeFormat, timeDetail, useSize, attr, textWidth, localPoint, navIndex, sameBox, each, f1, nextId,
  seriesClass, colorStyle, tween, presence, animateOf, type AnimateProp, type MaybeReactive, type DataProp, type Field, type FormatSpec, type Formatter,
  type ChartBaseProps, type TooltipProp, type Box, type XKind } from "../../../charts/util.ts";
import { Frame, Axis, Grid, tooltipState, showTip, thin, type Tick, type LegendItem } from "../../../charts/parts.ts";
import { RefMarks, statOf, type RefMarksProp, type MarkScales } from "../../../charts/marks.ts";
import { linePath } from "../../../charts/curve.ts";
import { syncGroup, windowRange, type WindowProp } from "../../../charts/sync.ts";
import { Navigator, type NavPath } from "../../../charts/navigator.ts";
import { clamp, type Handler } from "../../../core/util.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import { keyedLine, sma } from "./line.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** One candle as passed to `tooltip(point)` and `onSelect(point)`. */
export interface CandlePoint<D> { index: number; datum: D; x: unknown; label: unknown; open: number; high: number; low: number; close: number; volume: number | null; change: number; up: boolean }
/** Texts of the tooltip and the data table. */
export interface CandleLabels { open?: unknown; high?: unknown; low?: unknown; close?: unknown; volume?: unknown; change?: unknown }

export interface CandlestickChartProps<D = unknown> extends ChartBaseProps {
  /** Rows: an array (or signal / function returning one), sorted by x; it may grow live. @tr Satırlar: x'e göre sıralı bir dizi (ya da onu döndüren sinyal / fonksiyon); canlı büyüyebilir. */
  data?: DataProp<D>;
  /** The time of a row: a key or getter (default "date"). Dates → time axis, numbers → linear, else the row order. @tr Satırın zamanı: anahtar ya da getter (varsayılan "date"). Tarihler → zaman ekseni, sayılar → doğrusal, diğerleri → sıra. */
  x?: Field<D> | undefined;
  /** Forces the x scale: "time", "linear" or "band" (default detected: dates and epoch ms → time). @tr x ölçeğini zorlar: "time", "linear" ya da "band" (varsayılan veriden: tarihler ve epoch ms → zaman). */
  xType?: Opt<XKind>;
  /** Opening price: a key or getter (default "open"). @tr Açılış fiyatı: anahtar ya da getter (varsayılan "open"). */
  open?: Field<D> | undefined;
  /** Highest price: a key or getter (default "high"). @tr En yüksek fiyat: anahtar ya da getter (varsayılan "high"). */
  high?: Field<D> | undefined;
  /** Lowest price: a key or getter (default "low"). @tr En düşük fiyat: anahtar ya da getter (varsayılan "low"). */
  low?: Field<D> | undefined;
  /** Closing price: a key or getter (default "close"). @tr Kapanış fiyatı: anahtar ya da getter (varsayılan "close"). */
  close?: Field<D> | undefined;
  /** Volume: a key or getter; given, volume bars fill a lower pane. @tr Hacim: anahtar ya da getter; verilince alt bölmede hacim çubukları çizilir. */
  volume?: Field<D> | undefined;
  /** "candle" (default), "ohlc" (bars with open / close ticks) or "line" (the close). @tr "candle" (varsayılan), "ohlc" (açılış / kapanış çentikli çubuklar) ya da "line" (kapanış çizgisi). */
  type?: Opt<"candle" | "ohlc" | "line">;
  /** Color of rising candles: a theme token ("success", "brand-green"…) or a CSS color (default the theme's good color). @tr Yükselen mumların rengi: tema belirteci ("success", "brand-green"…) ya da CSS rengi (varsayılan temanın iyi rengi). */
  up?: Opt<string>;
  /** Color of falling candles: a theme token or a CSS color (default the theme's bad color). @tr Düşen mumların rengi: tema belirteci ya da CSS rengi (varsayılan temanın kötü rengi). */
  down?: Opt<string>;
  /** Moving averages of the close drawn over the candles, e.g. `[20, 50]`. @tr Mumların üzerine çizilen kapanış hareketli ortalamaları, ör. `[20, 50]`. */
  ma?: Opt<readonly number[]>;
  /** Reference marks: price lines and bands, date lines, notes (`{ y }`, `{ y: [a, b] }`, `{ x }`, `{ at: [x, y] }`). @tr Referans işaretleri: fiyat çizgileri ve bantları, tarih çizgileri, notlar (`{ y }`, `{ y: [a, b] }`, `{ x }`, `{ at: [x, y] }`). */
  marks?: RefMarksProp;
  /** A dashed line and tag at the last close (default true). @tr Son kapanışta kesik çizgi ve etiket (varsayılan true). */
  lastPrice?: Opt<boolean>;
  /** Show only the latest rows: `n`, `{ last: n }` or `{ ms: span }`; live data then slides. @tr Yalnız en son satırları gösterir: `n`, `{ last: n }` ya da `{ ms: span }`; canlı veri kayar. */
  window?: Opt<WindowProp>;
  /** Range navigator under the chart: `true` or its height in px (drag the window or its edges). @tr Grafiğin altında aralık gezgini: `true` ya da px yüksekliği (pencereyi ya da kenarlarını sürükleyin). */
  navigator?: Opt<boolean | number>;
  /** Drag across the plot to zoom (default true); double click, Escape or "Reset zoom" resets. @tr Yakınlaşmak için çizim üzerinde sürükleyin (varsayılan true); çift tıklama, Escape ya da "Reset zoom" sıfırlar. */
  zoom?: Opt<boolean>;
  /** Charts with the same `sync` name share the crosshair. @tr Aynı `sync` adlı grafikler artı imlecini paylaşır. */
  sync?: Opt<string>;
  /** Grid lines: `true` (default, horizontal), `false` or "both". @tr Izgara çizgileri: `true` (varsayılan, yatay), `false` ya da "both". */
  grid?: Opt<boolean | "both">;
  /** Price format: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Fiyat biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Volume format (default "compact"). @tr Hacim biçimi (varsayılan "compact"). */
  volumeFormat?: Opt<FormatSpec>;
  /** Format of the time labels: a pipe name, `[pipe, ...args]` or a function (default chosen by the span). @tr Zaman etiketlerinin biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan aralığa göre seçilir). */
  xFormat?: Opt<FormatSpec>;
  /** Header of the time column in the data table (default "Date"). @tr Veri tablosundaki zaman sütununun başlığı (varsayılan "Date"). */
  xLabel?: Opt<string>;
  /** Texts of the tooltip rows and table headers: `{ open, high, low, close, volume, change }`. @tr Araç ipucu satırlarının ve tablo başlıklarının yazıları: `{ open, high, low, close, volume, change }`. */
  labels?: Opt<CandleLabels>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<CandlePoint<D>>;
  /** Called with the candle on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki mumda Enter / Space'e basılınca mumla çağrılır. */
  onSelect?: Handler<[p: CandlePoint<D>]> | undefined;
  /** Change animation: `true` (spring, default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. @tr Değişim animasyonu: `true` (yay, varsayılan), `false`, easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da `(ctx) => …`. */
  animate?: AnimateProp | (() => AnimateProp);
}

interface Candle<D> { key: string; i: number; x: number; o: number; h: number; l: number; c: number; v: number | null; datum: D; leaving?: boolean }
interface Ohlc { o: number; h: number; l: number; c: number; v: number }

const M = { t: 12, r: 8, b: 28, gap: 10 };
const NAMES = /^[a-z]+(-[a-z0-9]+)*$/;
const CSS_COLORS = new Set(["white", "black", "red", "green", "blue", "orange", "purple", "gray", "grey", "gold", "pink", "teal", "navy"]);
/** Theme token or CSS color → a value for a custom property. */
const colorOf = (c: string): string => (c.startsWith("--") ? `var(${c})` : NAMES.test(c) && !CSS_COLORS.has(c) ? `var(--m-${c})` : c);

/** Candlestick / OHLC / close-line chart with volume, moving averages, marks, a live window and a range navigator. */
export function CandlestickChart<D>(props: CandlestickChartProps<D>): Element {
  const size = useSize(props, 640, 320);
  const hidden = signal(new Set<string>()), active = signal(-1), view = signal<[number, number] | null>(null), drag = signal<[number, number] | null>(null);
  const synced = signal(-1), crossY = signal<number | null>(null);
  const tip = tooltipState(), id = nextId("m-candle"), clip = `${id}-clip`;
  const how = (): AnimateProp => animateOf(props.animate);
  let svg: Element | null = null, dragged = false, mounted = false;

  const rows = computed(() => rowsOf(props.data));
  const xRaw = computed(() => { const g = accessor<D>(props.x ?? "date", (_d, i) => i); return rows().map((d, i) => g(d, i)); });
  // epoch ms numbers (> year 1973) count as time; `xType` forces a kind
  const xType = computed((): XKind => { const forced = read(props.xType), k = xKind(xRaw(), forced); return !forced && k === "linear" && Number(xRaw().find((v) => v != null)) > 1e11 ? "time" : k; });
  const all = computed((): Candle<D>[] => {
    const r = rows(), raw = xRaw(), tp = xType();
    const O = accessor<D>(props.open ?? "open"), H = accessor<D>(props.high ?? "high"), L = accessor<D>(props.low ?? "low"), C = accessor<D>(props.close ?? "close");
    const V = props.volume != null ? accessor<D>(props.volume) : null;
    const out: Candle<D>[] = [];
    r.forEach((d, i) => {
      const c = num(C(d, i));
      if (c == null) return;
      const o = num(O(d, i)) ?? c, hi = Math.max(num(H(d, i)) ?? c, o, c), lo = Math.min(num(L(d, i)) ?? c, o, c);
      const x = tp === "time" ? timeMs(raw[i]) : tp === "linear" ? Number(raw[i]) : i;
      out.push({ key: String(x), i: out.length, x, o, h: hi, l: lo, c, v: V ? num(V(d, i)) : null, datum: d });
    });
    return out;
  });
  const xs0 = computed(() => all().map((c) => c.x));
  const range = computed((): [number, number] => {
    const n = all().length, z = view();
    if (z) return [clamp(z[0], 0, Math.max(0, n - 1)), clamp(z[1], 0, n - 1)];
    return windowRange(n, xs0(), read(props.window) as WindowProp);
  }, { equals: (a, b) => !!a && a[0] === b[0] && a[1] === b[1] });
  const shown = computed(() => { const [a, b] = range(); return all().slice(a, b + 1); });
  const type = computed(() => read(props.type) ?? "candle");
  const hasVolume = computed(() => props.volume != null && !hidden().has("volume"));
  const maList = computed(() => (read(props.ma) ?? []).filter((n) => n > 1).map((n, j) => ({ key: `ma${n}`, label: `MA ${n}`, n, index: j })));
  const maVals = computed(() => { const c = all().map((d) => d.c); return new Map(maList().map((m) => [m.key, sma(c, m.n)])); });

  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const vFmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.volumeFormat), (v) => applyPipe("compact", v)));
  const lab = (k: keyof CandleLabels, def: () => string): string => String(read(props.labels)?.[k] ?? def());

  // ---- domains (targets), then tweened so zooming and live appends glide
  const step = computed(() => {
    const s = shown();
    let m = Infinity;
    for (let i = 1; i < s.length; i++) { const d = (s[i] as Candle<D>).x - (s[i - 1] as Candle<D>).x; if (d > 0 && d < m) m = d; }
    return isFinite(m) ? m : xType() === "time" ? 864e5 : 1;
  });
  const target = computed(() => {
    const s = shown(), st = step();
    if (!s.length) return { x0: 0, x1: 1, y0: 0, y1: 1, v1: 1 };
    let lo = Infinity, hi = -Infinity, v1 = 0;
    const [a, b] = range(), ma = maVals();
    for (const d of s) { if (d.l < lo) lo = d.l; if (d.h > hi) hi = d.h; if ((d.v ?? 0) > v1) v1 = d.v ?? 0; }
    for (const m of maList()) if (!hidden().has(m.key)) for (let i = a; i <= b; i++) { const v = ma.get(m.key)?.[i]; if (v != null) { if (v < lo) lo = v; if (v > hi) hi = v; } }
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.06;
    return { x0: (s[0] as Candle<D>).x - st * 0.6, x1: (s[s.length - 1] as Candle<D>).x + st * 0.6, y0: lo - pad, y1: hi + pad, v1: v1 || 1 };
  });
  const dom = tween(target, ["x0", "x1", "y0", "y1", "v1"], how, undefined, { key: "domain" });

  // ---- layout: price pane above, volume pane below, the price axis on the right
  const yTickVals = computed(() => { const tg = target(); return scaleLinear([tg.y0, tg.y1], [0, 1]).ticks(Math.max(2, Math.floor((size.height() - M.t - M.b) / 46))); });
  const box = computed((): Box => {
    const f = fmt(), mr = Math.min(120, Math.max(40, 14 + Math.max(0, ...yTickVals().map((v) => textWidth(f(v))))));
    const total = Math.max(20, size.height() - M.t - M.b), ph = hasVolume() ? Math.round(total * 0.74) : total;
    return { x: M.r, y: M.t, w: Math.max(10, size.width() - M.r - mr), h: ph };
  }, { equals: sameBox });
  const vbox = computed((): Box => { const b = box(), total = Math.max(20, size.height() - M.t - M.b); return { x: b.x, y: b.y + b.h + M.gap, w: b.w, h: Math.max(0, total - b.h - M.gap) }; }, { equals: sameBox });
  const full = computed((): Box => { const b = box(), v = vbox(); return hasVolume() ? { x: b.x, y: b.y, w: b.w, h: v.y + v.h - b.y } : b; }, { equals: sameBox });
  const xs = computed(() => scaleLinear([dom().x0, dom().x1], [0, box().w]));
  const ys = computed(() => scaleLinear([dom().y0, dom().y1], [box().h, 0]));
  const vs = computed(() => scaleLinear([0, dom().v1], [vbox().h, 0]));
  const bodyW = computed(() => { const d = dom(); return Math.max(1, (step() * box().w) / ((d.x1 - d.x0) || 1) * 0.68); });

  const xFmtOf = (time: (span: number) => Formatter) => computed((): Formatter => {
    const f = read<FormatSpec | null | undefined>(props.xFormat);
    if (f != null) return formatter(f);
    const tp = xType(), raw = xRaw();
    if (tp === "time") { const tg = target(); return time(tg.x1 - tg.x0); }
    return tp === "band" ? (v) => String(raw[Number(v)] ?? "") : (v) => applyPipe("number", v);
  });
  const xFmt = xFmtOf(timeDetail), xTickFmt = xFmtOf(timeFormat);
  const xTicks = computed((): Tick[] => {
    const n = Math.max(2, Math.floor(box().w / 64)), s = xs(), f = xTickFmt(), d = dom(), tp = xType();
    const vals = tp === "time" ? timeTicks(d.x0, d.x1, n) : tp === "linear" ? s.ticks(n) : thin(shown().map((c) => c.x), n);
    return vals.map((v) => ({ key: v, pos: s(v), label: f(v) }));
  });
  const yTicks = computed((): Tick[] => { const s = ys(), f = fmt(), h0 = box().h; return yTickVals().map((v) => ({ key: v, pos: s(v), label: f(v) })).filter((t) => t.pos >= -1 && t.pos <= h0 + 1); });
  const grid = computed(() => read(props.grid) ?? true);
  const colorVars = (): Record<string, string> => {
    const o: Record<string, string> = {}, u = read(props.up), dn = read(props.down);
    if (u) o["--m-candle-up"] = colorOf(u);
    if (dn) o["--m-candle-down"] = colorOf(dn);
    return o;
  };

  // ---- candles: presence keeps the leaving ones until they have shrunk
  const pres = presence(shown, (c) => c.key, how);
  const candle = (c: () => Candle<D>, i: () => number): Element => {
    const key = c().key, late = mounted;
    const shape = (d: Candle<D>): Ohlc => (d.leaving ? { o: d.o, h: d.o, l: d.o, c: d.o, v: 0 } : { o: d.o, h: d.h, l: d.l, c: d.c, v: d.v ?? 0 });
    const g = tween(() => shape(c()), ["o", "h", "l", "c", "v"], how, (to) => ({ o: to.o, h: to.o, l: to.o, c: to.o, v: 0 }),
      { index: () => (late ? 0 : i()), key, leaving: () => !!c().leaving, onSettle: () => { if (untrack(c).leaving) pres.done(key); } });
    const cx = attr(() => f1(xs()(c().x)));
    const y = (k: keyof Ohlc): (() => number) => attr(() => f1(ys()(g()[k])));
    const yo = y("o"), yc = y("c"), yh = y("h"), yl = y("l");
    const half = attr(() => f1(bodyW() / 2));
    const up = (): boolean => c().c >= c().o;
    const isActive = (): boolean => { const a = active(), s = synced(); const k = a >= 0 ? all()[a]?.key : s >= 0 ? all()[s]?.key : undefined; return k === key; };
    return h("g", { class: () => `m-candle ${up() ? "m-candle-up" : "m-candle-down"}`, "class:m-chart-active": isActive, "class:m-candle-leaving": () => !!c().leaving, "data-key": key },
      () => (hasVolume() ? h("rect", { class: "m-candle-volume", x: attr(() => f1(cx() - half())), width: attr(() => f1(half() * 2)),
        y: attr(() => f1(vbox().y - box().y + vs()(g().v))), height: attr(() => f1(Math.max(0, vbox().h - vs()(g().v)))) }) : null),
      () => {
        const tp = type();
        if (tp === "line") return null;
        if (tp === "ohlc") return [
          h("line", { class: "m-candle-wick", x1: cx, x2: cx, y1: yh, y2: yl }),
          h("line", { class: "m-candle-tick", x1: attr(() => cx() - half()), x2: cx, y1: yo, y2: yo }),
          h("line", { class: "m-candle-tick", x1: cx, x2: attr(() => cx() + half()), y1: yc, y2: yc })];
        return [
          h("line", { class: "m-candle-wick", x1: cx, x2: cx, y1: yh, y2: yl }),
          h("rect", { class: "m-candle-body", x: attr(() => f1(cx() - half())), width: attr(() => f1(half() * 2)),
            y: attr(() => Math.min(yo(), yc())), height: attr(() => f1(Math.max(1, Math.abs(yo() - yc())))) })];
      });
  };

  // close line (type "line") and moving averages: keyed by x, so a sliding window keeps each point
  const closeLine = keyedLine(() => ({ x: shown().map((c) => c.x), y: shown().map((c) => c.c) }), how, "close");
  const pathOf = (l: { x: readonly number[]; y: readonly (number | null)[] }, smooth = false): string => {
    const s = xs(), y = ys();
    return linePath(l.x.map((x, i) => { const v = l.y[i]; return v == null ? null : [s(x), y(v)] as const; }), smooth ? "smooth" : "linear");
  };
  const maLine = (m: () => { key: string; n: number; index: number }): Element => {
    const key = m().key;
    const line = keyedLine(() => { const [a, b] = range(), v = maVals().get(key) ?? []; return { x: shown().map((c) => c.x), y: v.slice(a, b + 1) }; }, how, key);
    return h("path", { class: () => `m-chart-line m-candle-ma ${seriesClass(m().index)}`, style: () => colorStyle(props.colors, m().index), "data-series": key, d: attr(() => pathOf(line(), true)) });
  };

  // ---- interaction
  const pointAt = (i: number): CandlePoint<D> | undefined => {
    const d = all()[i];
    if (!d) return undefined;
    const prev = all()[i - 1], base = prev ? prev.c : d.o;
    return { index: i, datum: d.datum, x: xType() === "time" ? new Date(d.x) : xRaw()[rows().indexOf(d.datum)], label: xFmt()(d.x), open: d.o, high: d.h, low: d.l, close: d.c, volume: d.v,
      change: base ? (d.c - base) / base : 0, up: d.c >= d.o };
  };
  const tipContent = (p: CandlePoint<D>): Element => {
    const f = fmt(), row = (k: keyof CandleLabels, def: () => string, v: unknown, cls = ""): Element =>
      h("div", { class: `m-chart-tip-row m-candle-tip-${k}${cls}` }, h("span", { class: "m-chart-tip-label" }, lab(k, def)), h("span", { class: "m-chart-tip-value" }, String(v)));
    return h("div", { class: `m-chart-tip m-candle-tip ${p.up ? "m-candle-up" : "m-candle-down"}`, style: colorVars() },
      h("div", { class: "m-chart-tip-title" }, String(p.label)),
      row("open", () => t`Open`, f(p.open)), row("high", () => t`High`, f(p.high)), row("low", () => t`Low`, f(p.low)), row("close", () => t`Close`, f(p.close)),
      row("change", () => t`Change`, `${p.change >= 0 ? "+" : ""}${applyPipe("percent", p.change, 2)}`, " m-candle-delta"),
      p.volume != null && props.volume != null ? row("volume", () => t`Volume`, vFmt()(p.volume)) : null);
  };
  const syncName = (): string | null => read(props.sync) ?? null;
  const show = (i: number, py?: number): void => {
    active.set(i);
    crossY.set(py ?? null);
    const d = all()[i], name = syncName();
    if (name && d) syncGroup(name).set({ from: id, x: d.x });
    const opt = read(props.tooltip), p = pointAt(i);
    if (!d || !p || opt === false) return void tip.at.set(null);
    const content = typeof opt === "function" ? () => (opt as (p: CandlePoint<D>) => unknown)(p) : () => tipContent(p);
    showTip(tip, svg, size.width(), box().x + xs()(d.x), box().y + ys()(d.h), content);
  };
  const hide = (): void => {
    active.set(-1); crossY.set(null); tip.at.set(null);
    const name = syncName();
    if (name && syncGroup(name).peek()?.from === id) syncGroup(name).set(null);
  };
  effect(() => {
    const name = syncName(), s = name ? syncGroup(name)() : null;
    if (!s || s.from === id) return void synced.set(-1);
    const x = Number(s.x), list = untrack(all), [a, b] = untrack(range);
    let best = -1;
    for (let i = a; i <= b; i++) if (best < 0 || Math.abs((list[i] as Candle<D>).x - x) < Math.abs((list[best] as Candle<D>).x - x)) best = i;
    synced.set(best);
  });
  // the tooltip rides along while the candles slide or the zoom glides
  effect(() => { dom(); const i = untrack(active); if (i >= 0) untrack(() => show(i, crossY.peek() ?? undefined)); });
  const nearest = (px: number): number => {
    const [a, b] = range(), list = all(), tx = xs().invert(px);
    if (b < a) return -1;
    let lo = a, hi = b;
    while (lo < hi) { const m = (lo + hi) >> 1; if ((list[m] as Candle<D>).x < tx) lo = m + 1; else hi = m; }
    return lo > a && Math.abs((list[lo - 1] as Candle<D>).x - tx) <= Math.abs((list[lo] as Candle<D>).x - tx) ? lo - 1 : lo;
  };
  const pt = (e: PointerEvent): [number, number] => { const [x, y] = localPoint(svg, e, size.width()); return [x - box().x, y - box().y]; };
  const clampX = (p: number): number => clamp(p, 0, box().w);
  const select = (): void => { const p = pointAt(active.peek()); if (p) props.onSelect?.(p); };
  const zoomOn = (): boolean => read(props.zoom) ?? true;
  const resetZoom = (): void => { view.set(null); hide(); };

  const handlers = {
    onPointerDown: (e: PointerEvent) => { if (zoomOn()) { const p = clampX(pt(e)[0]); drag.set([p, p]); dragged = false; } },
    onPointerMove: (e: PointerEvent) => {
      const d = drag.peek(), [x, y] = pt(e);
      if (d) return void drag.set([d[0], clampX(x)]);
      show(nearest(x), clamp(y, 0, box().h));
    },
    onPointerUp: () => {
      const d = drag.peek();
      if (!d) return;
      drag.set(null);
      if (Math.abs(d[1] - d[0]) < 4) return;
      dragged = true;
      const i0 = nearest(Math.min(...d)), i1 = nearest(Math.max(...d));
      if (i1 - i0 >= 2) { view.set([i0, i1]); hide(); }
    },
    onPointerLeave: () => { if (!drag.peek()) hide(); },
    onClick: () => { if (!dragged) select(); dragged = false; },
    onDblClick: resetZoom,
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") { if (view.peek()) view.set(null); return hide(); }
    const [a, b] = range();
    const i = navIndex(e.key, active.peek(), a, b);
    if (i == null || b < a) return;
    e.preventDefault();
    show(i);
  };

  // ---- the crosshair, the last price tag, marks
  const focusIdx = (): number => (active() >= 0 ? active() : synced());
  const focusX = attr(() => { const i = focusIdx(), d = all()[i]; return d ? f1(xs()(d.x)) : 0; });
  const crossAt = attr((): number | null => { const y = crossY(); if (y != null) return y; const i = active(), d = all()[i]; return d ? f1(ys()(d.c)) : null; });
  const last = computed(() => { const s = shown(); return s[s.length - 1]; });
  const lastY = attr(() => { const d = last(); return d ? f1(ys()(d.c)) : 0; });
  const tag = (y: () => number | null, text: () => string, cls: string): Element => h("g", { class: cls, transform: attr(() => `translate(${box().w},${y() ?? 0})`), visibility: () => (y() == null ? "hidden" : "visible") },
    h("rect", { x: 0, y: -9, height: 18, rx: 4, width: attr(() => textWidth(text(), 6.4) + 12) }),
    h("text", { x: 6, dy: "0.32em" }, text));
  const scales: MarkScales = {
    box, x: (v) => { const ms = xType() === "time" ? timeMs(v) : Number(v); return isFinite(ms) ? xs()(ms) : null; }, y: (v) => ys()(v),
    stat: (s) => statOf(shown().map((d) => d.c), s), fmtX: (v) => xFmt()(xType() === "time" ? timeMs(v) : v), fmtY: (v) => fmt()(v),
  };

  const body = [
    h("defs", {}, h("clipPath", { id: clip }, h("rect", { x: 0, y: -2, width: attr(() => box().w), height: attr(() => full().h + 4) }))),
    Grid({ dir: "h", ticks: () => (grid() ? yTicks() : []), box }),
    Grid({ dir: "v", ticks: () => (grid() === "both" ? xTicks() : []), box: full }),
    Axis({ side: "right", ticks: yTicks, box }),
    Axis({ side: "bottom", ticks: xTicks, box: full }),
    RefMarks({ marks: props.marks, scales, layer: "back" }),
    h("g", { class: "m-chart-plot m-candle-plot", "class:m-candle-ohlc": () => type() === "ohlc", transform: attr(() => `translate(${box().x},${box().y})`), style: colorVars },
      h("g", { "clip-path": `url(#${clip})` },
        () => (hasVolume() ? h("line", { class: "m-candle-pane", x1: 0, x2: attr(() => box().w), y1: attr(() => box().h + M.gap / 2), y2: attr(() => box().h + M.gap / 2) }) : null),
        each<Candle<D>>({ each: pres.items, key: (c) => c.key, children: candle }),
        () => (type() === "line" ? h("path", { class: () => `m-chart-line m-candle-close ${last() && last()!.c >= (shown()[0]?.c ?? 0) ? "m-candle-up" : "m-candle-down"}`, d: attr(() => pathOf(closeLine())) }) : null),
        each<{ key: string; label: string; n: number; index: number }>({ each: () => maList().filter((m) => !hidden().has(m.key)), key: (m) => m.key, children: maLine })),
      () => (read(props.lastPrice) === false || !last() ? null
        : h("g", { class: () => `m-candle-last ${last()!.c >= last()!.o ? "m-candle-up" : "m-candle-down"}` },
          h("line", { x1: 0, x2: attr(() => box().w), y1: lastY, y2: lastY }),
          tag(lastY, () => fmt()(last()!.c) as string, "m-candle-tag"))),
      h("g", { class: "m-chart-focus m-candle-cross", visibility: () => (focusIdx() >= 0 ? "visible" : "hidden") },
        h("line", { class: "m-chart-guide", x1: focusX, x2: focusX, y1: 0, y2: attr(() => full().h) }),
        h("line", { class: "m-chart-guide", x1: 0, x2: attr(() => box().w), y1: attr(() => crossAt() ?? 0), y2: attr(() => crossAt() ?? 0), visibility: () => (crossAt() == null || active() < 0 ? "hidden" : "visible") }),
        tag(() => (active() < 0 ? null : crossAt()), () => String(fmt()(ys().invert(crossAt() ?? 0))), "m-candle-tag m-candle-tag-cross"))),
    RefMarks({ marks: props.marks, scales, layer: "front" }),
    h("rect", { class: "m-chart-brush", visibility: () => (drag() ? "visible" : "hidden"), y: () => box().y, height: () => full().h,
      x: () => box().x + Math.min(...(drag() ?? [0])), width: () => { const d = drag(); return d ? Math.abs(d[1] - d[0]) : 0; } }),
    h("rect", { class: "m-chart-overlay", x: () => box().x, y: () => box().y, width: () => box().w, height: () => full().h, ...handlers }),
  ];

  // ---- range navigator (fractions of the row order)
  const navH = (): number => { const n = read(props.navigator); return typeof n === "number" ? n : 48; };
  const navRange = (): readonly [number, number] | null => {
    const n = all().length;
    if (n < 2) return null;
    const [a, b] = range();
    return a === 0 && b === n - 1 ? null : [a / (n - 1), b / (n - 1)];
  };
  const navPaths = computed((): NavPath[] => {
    const list = all(), n = list.length, w = box().w, hh = navH();
    if (n < 2) return [];
    let lo = Infinity, hi = -Infinity;
    for (const d of list) { if (d.c < lo) lo = d.c; if (d.c > hi) hi = d.c; }
    const sy = scaleLinear([lo, hi], [hh - 4, 4]), k = Math.max(1, Math.floor(n / Math.max(2, w)));
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i += k) pts.push([f1((i / (n - 1)) * w), f1(sy((list[i] as Candle<D>).c))]);
    const line = `M${pts.map((p) => p.join(",")).join("L")}`;
    return [{ key: "close", line, area: `${line}L${pts[pts.length - 1]![0]},${hh}L0,${hh}Z`, cls: "m-candle-nav" }];
  });
  const nav = (): Element | null => (read(props.navigator) ? Navigator({
    width: size.width, x: () => box().x, w: () => box().w, height: navH, range: navRange,
    onRange: (r) => { const n = all().length; if (!r) return view.set(null); view.set([Math.round(r[0] * (n - 1)), Math.round(r[1] * (n - 1))]); hide(); },
    paths: navPaths, valueText: (f) => { const d = all()[Math.round(f * (all().length - 1))]; return d ? String(xFmt()(d.x)) : ""; },
  }) : null);

  const legendItems = (): readonly LegendItem[] => {
    if (read(props.legend) === false) return [];
    const items: LegendItem[] = maList().map((m) => ({ key: m.key, label: m.label, index: m.index }));
    if (props.volume != null) items.push({ key: "volume", label: lab("volume", () => t`Volume`), index: -1 });
    return read(props.legend) == null && !items.length ? [] : items;
  };
  const el = Frame<Candle<D>>(props, {
    kind: "candlestick", size, body, onKeyDown, svgRef: (e) => { svg = e; },
    empty: () => all().length === 0, tip,
    legend: { items: legendItems, hidden },
    table: {
      caption: () => read(props.title), rows: all,
      columns: () => [{ label: read(props.xLabel) ?? t`Date`, value: (d: Candle<D>) => untrack(xFmt)(d.x) },
        { label: lab("open", () => t`Open`), value: (d: Candle<D>) => untrack(fmt)(d.o) }, { label: lab("high", () => t`High`), value: (d: Candle<D>) => untrack(fmt)(d.h) },
        { label: lab("low", () => t`Low`), value: (d: Candle<D>) => untrack(fmt)(d.l) }, { label: lab("close", () => t`Close`), value: (d: Candle<D>) => untrack(fmt)(d.c) },
        ...(props.volume != null ? [{ label: lab("volume", () => t`Volume`), value: (d: Candle<D>) => untrack(vFmt)(d.v) }] : [])],
    },
    extra: [() => nav(), h("button", { type: "button", class: "m-chart-reset", hidden: () => !view(), onClick: resetZoom }, () => t`Reset zoom`)],
  });
  mounted = true;
  return el;
}
